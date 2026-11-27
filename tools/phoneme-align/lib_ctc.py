"""Pure CTC forced-alignment logic — no torch, no I/O, no model loading.

Operates on plain lists of log-probabilities shaped [frames][vocab]. The trellis has a
start-of-sequence column 0 (blank-only paths); column j in 1..N means the first j target
tokens have been emitted. Each token occupies its emission frame and blank frames keep
the current column, so a token's span runs from its frame to the frame before the next token.
"""

from array import array

NEG_INF = float('-inf')


def get_trellis(emission, tokens, blank_id=0):
    """CTC alignment trellis with a start-of-sequence column.

    @param {list[list[float]]} emission - log-probabilities [frames][vocab]
    @param {list[int]} tokens - target token ids (transcript, no blanks)
    @param {int} blank_id - CTC blank token id
    @returns {list[list[float]]} trellis [frames+1][len(tokens)+1] of best-path scores
    """
    T, N = len(emission), len(tokens)
    tr = [array('d', [NEG_INF]) * (N + 1) for _ in range(T + 1)]
    tr[0][0] = 0.0
    for t in range(T):
        tr[t + 1][0] = tr[t][0] + emission[t][blank_id]
    for t in range(T):
        e, prev, cur = emission[t], tr[t], tr[t + 1]
        for j in range(1, N + 1):
            stay = prev[j] + e[blank_id]
            change = prev[j - 1] + e[tokens[j - 1]]
            cur[j] = stay if stay >= change else change
    return tr


def backtrack(trellis, emission, tokens, blank_id=0):
    """Backtrack the best path through the trellis.

    @param {list[list[float]]} trellis - from get_trellis
    @param {list[list[float]]} emission - log-probabilities [frames][vocab]
    @param {list[int]} tokens - target token ids
    @returns {list[tuple[int,int]]} (frame, column) per frame once the first token is reached; column j means tokens[0..j-1] have been emitted
    """
    t, j = len(trellis) - 1, len(trellis[0]) - 1
    path = []
    while j > 0 and t > 0:
        stay = trellis[t - 1][j] + emission[t - 1][blank_id]
        change = trellis[t - 1][j - 1] + emission[t - 1][tokens[j - 1]]
        path.append((t - 1, j))
        t -= 1
        if change > stay:
            j -= 1
    return path[::-1]


def merge_segments(path, frame_sec):
    """Merge the frame path into per-token time spans.

    @param {list[tuple[int,int]]} path - from backtrack()
    @param {float} frame_sec - seconds per emission frame (wav2vec2 stride, ~0.02)
    @returns {list[tuple[int,float,float]]} (token_pos, start_sec, end_sec), one per contiguous run of the same column; token_pos is 1-based against the target tokens
    """
    if not path:
        return []
    segs = []
    start_frame = path[0][0]
    prev_j = path[0][1]
    prev_f = path[0][0]
    for f, j in path[1:]:
        if j != prev_j:
            segs.append((prev_j, start_frame * frame_sec, (prev_f + 1) * frame_sec))
            start_frame = f
            prev_j = j
        prev_f = f
    segs.append((prev_j, start_frame * frame_sec, (prev_f + 1) * frame_sec))
    return segs


def align_spans(emission, tokens, frame_sec, blank_id=0):
    """Forced alignment of target tokens against emission frames.

    @param {list[list[float]]} emission - log-probabilities [frames][vocab]
    @param {list[int]} tokens - target token ids
    @param {float} frame_sec - seconds per frame
    @param {int} blank_id - CTC blank token id
    @returns {list[tuple[int,float,float]]} (1-based token position, start seconds, end seconds); empty when the frames cannot hold every token
    """
    if not tokens or len(emission) < len(tokens):
        return []
    trellis = get_trellis(emission, tokens, blank_id)
    if trellis[-1][-1] == NEG_INF:
        return []
    return merge_segments(backtrack(trellis, emission, tokens, blank_id), frame_sec)


def split_runs_keep_spaces(transcript):
    """Indices of non-space characters grouped by whitespace-delimited runs.
    @returns {list[list[int]]} character positions per run"""
    runs = []
    cur = []
    for i, ch in enumerate(transcript):
        if ch.isspace():
            if cur:
                runs.append(cur)
                cur = []
        else:
            cur.append(i)
    if cur:
        runs.append(cur)
    return runs


def group_words_by_runs(char_spans, transcript, max_chars=6):
    """Like group_words but respects whitespace runs: chunks never merge across spaces,
    and long spaceless runs split every max_chars. This is the correct karaoke shape:
    English gives real words, Thai gives subword pieces."""
    spans_by_pos = {}
    for pos, s, e in sorted(char_spans, key=lambda x: x[0]):
        spans_by_pos[pos - 1] = (s, e)
    chunks = []
    for run in split_runs_keep_spaces(transcript):
        i = 0
        while i < len(run):
            piece = [p for p in run[i:i + max_chars] if p in spans_by_pos]
            if piece:
                text = ''.join(transcript[p] for p in piece)
                chunks.append([text, round(spans_by_pos[piece[0]][0], 3),
                               round(spans_by_pos[piece[-1]][1], 3)])
            i += max_chars
    return chunks
