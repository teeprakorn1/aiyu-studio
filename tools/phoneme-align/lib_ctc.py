"""Pure CTC forced-alignment logic — no I/O, no model loading.

Implements the trellis/backtrack/merge pipeline from the torchaudio forced-alignment
tutorial as dependency-light torch tensor ops, plus grouping of aligned characters into
word chunks in the mix-studio wordtimes schema. Separated from the CLI so the logic is
unit-testable with synthetic emissions (no model, no network, no audio).
"""


def get_trellis(emission, tokens, blank_id=0):
    """CTC alignment trellis.

    @param {torch.Tensor} emission - log-probabilities [num_frame, num_tokens]
    @param {list[int]} tokens - target token ids (transcript, no blanks)
    @param {int} blank_id - CTC blank token id
    @returns {torch.Tensor} trellis [num_frame, len(tokens)] of best-path scores
    """
    import torch
    num_frame = emission.size(0)
    num_tokens = len(tokens)
    trellis = torch.zeros((num_frame, num_tokens))
    trellis[1:, 0] = torch.cumsum(emission[1:, blank_id], 0)
    trellis[0, 1:] = -float('inf')
    trellis[-num_tokens + 1:, 0] = float('inf')
    for t in range(num_frame - 1):
        trellis[t + 1, 1:] = torch.maximum(
            trellis[t, 1:] + emission[t, blank_id],        # stay on same token
            trellis[t, :-1] + emission[t, tokens[1:]],     # advance to next token
        )
    return trellis


def backtrack(trellis, emission, tokens, blank_id=0):
    """Backtrack the best path through the trellis.

    @returns {list[tuple[int,int]]} (frame, token_pos) path, one entry per frame,
        token_pos is 1-based against the target token list (0 = pre-start)
    """
    t, j = trellis.size(0) - 1, trellis.size(1) - 1
    path = []
    while j > 0 and t > 0:
        p_stay = trellis[t - 1, j] + emission[t - 1, blank_id]
        p_change = trellis[t - 1, j - 1] + emission[t - 1, tokens[j - 1]] if j - 1 >= 0 else -float('inf')
        path.append((t - 1, j))
        t -= 1
        if p_change > p_stay:
            j -= 1
    return path[::-1]


def merge_segments(path, frame_sec):
    """Merge the frame path into per-token time spans.

    @param {list[tuple[int,int]]} path - from backtrack()
    @param {float} frame_sec - seconds per emission frame (wav2vec2 stride, ~0.02)
    @returns {list[tuple[int,float,float]]} (token_pos, start_sec, end_sec), one per
        contiguous run of the same token_pos — token_pos is 1-based transcript position
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
