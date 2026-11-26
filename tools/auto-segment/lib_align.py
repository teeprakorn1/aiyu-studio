"""Pure alignment/grouping logic for tools/auto-segment — importable and testable
without faster-whisper. All functions are deterministic and dependency-free (stdlib only).

The alignment model: whisper produces word-level timestamps; we collapse everything
(words and dialogue lines alike) into normalized character streams — Thai has no spaces,
so characters are the only reliable unit across languages — then scan forward
sequentially, since a reader performs the lines in order by construction.
"""
import difflib
import unicodedata


def norm_text(s):
    """Normalize for matching: lowercase, drop whitespace/punctuation/symbols, keep
    letters/numbers AND combining marks — Thai vowel signs and tone marks are Unicode
    marks (M*), not alphanumerics, but they carry most of the phonetic signal."""
    return ''.join(ch.lower() for ch in s
                   if unicodedata.category(ch)[0] in ('L', 'N', 'M'))


def build_stream(words):
    """Collapse word-level timestamps into a character stream with per-char times.

    words: iterable of (text, start_sec, end_sec) — as produced by whisper word timestamps.
    Returns (stream, t0, t1): string of normalized chars, plus per-char start/end arrays.
    Characters within a word interpolate linearly across the word's time span.
    """
    chars, t0, t1 = [], [], []
    for item in words:
        text, ws, we = item[0], float(item[1]), float(item[2])
        n = norm_text(text)
        if not n:
            continue
        dur = max(1e-3, we - ws)
        for k, ch in enumerate(n):
            chars.append(ch)
            t0.append(ws + dur * k / len(n))
            t1.append(ws + dur * (k + 1) / len(n))
    return ''.join(chars), t0, t1


def _ratio(needle, cand):
    """Similarity 0..1 between needle and cand, cheap-prefiltered."""
    if not needle or not cand:
        return 0.0
    sm = difflib.SequenceMatcher(None, needle, cand, autojunk=False)
    if sm.real_quick_ratio() < 0.4:
        return 0.0
    if sm.quick_ratio() < 0.4:
        return 0.0
    return sm.ratio()


def align_lines(words, line_texts, search_ahead=3.0, len_slack=(0.7, 1.5)):
    """Align dialogue lines to the transcript stream sequentially.

    line_texts: list of dialogue line strings in order.
    Returns one dict per line: {line, start, end, conf} — start/end in seconds, or
    None with conf 0.0 when no acceptable match exists. pos advances monotonically:
    a line never matches before the previous line's end, mirroring how the audio was read.
    """
    stream, t0, t1 = build_stream(words)
    pos = 0
    out = []
    for idx, txt in enumerate(line_texts):
        L = norm_text(txt)
        if not L:
            out.append({'line': idx, 'start': None, 'end': None, 'conf': 0.0})
            continue
        lo = max(2, int(len(L) * len_slack[0]))
        hi = max(lo + 1, int(len(L) * len_slack[1]) + 2)
        horizon = min(len(stream), pos + int(len(L) * search_ahead) + 40)
        best = (0.0, -1, -1)
        for wlen in range(lo, hi + 1):
            last_st = min(len(stream) - wlen, horizon - wlen)
            for st in range(pos, last_st + 1):
                score = _ratio(L, stream[st:st + wlen])
                if score > best[0]:
                    best = (score, st, st + wlen)
        conf, st, en = best
        if st < 0 or conf <= 0.0:
            out.append({'line': idx, 'start': None, 'end': None, 'conf': 0.0})
            continue
        out.append({'line': idx, 'start': t0[st], 'end': t1[en - 1], 'conf': round(conf, 3)})
        pos = en  # monotone advance — next line starts no earlier than this line's end
    return out


def group_aligned(aligned, spk, group_max=25.0, narrator='M'):
    """Turn per-line alignment of ONE speaker's audio into cut groups.

    aligned: output of align_lines for this speaker's lines (in line order).
    spk: the speaker id — constant within one raw-vo file by design.
    Character (non-narrator) lines always stand alone — one file per line, precise timing.
    Narrator lines merge greedily while consecutive and the group stays under group_max
    seconds. Lines whose alignment failed are skipped — the caller reports them.
    Returns list of groups: {lines, start, end, spk}.
    """
    groups = []
    cur = None
    for a in aligned:
        if a['start'] is None:
            continue
        if spk != narrator:
            groups.append({'lines': [a['line']], 'start': a['start'], 'end': a['end'], 'spk': spk})
            continue
        contiguous = cur is not None and a['line'] == cur['lines'][-1] + 1
        if cur is not None and contiguous and (a['end'] - cur['start']) <= group_max:
            cur['lines'].append(a['line'])
            cur['end'] = a['end']
        else:
            cur = {'lines': [a['line']], 'start': a['start'], 'end': a['end'], 'spk': spk}
            groups.append(cur)
    return groups


def file_name(group, narrator='M'):
    """Production naming convention: narrator n<from>-<to>.wav, characters c<line>_<spk>.wav."""
    first, last = group['lines'][0], group['lines'][-1]
    if group['spk'] == narrator:
        return f"n{first:03d}-{last:03d}.wav"
    return f"c{first:03d}_{group['spk']}.wav"


def cut_ranges(groups, pad=0.08, audio_dur=None):
    """Apply padding to group boundaries, clamped to [0, audio_dur]. Adjacent groups may
    overlap slightly after padding — ffmpeg slicing is cheap and a few ms of overlap at
    edges is trimmed by the mixer's silence trimming anyway."""
    out = []
    for g in groups:
        a = max(0.0, g['start'] - pad)
        b = g['end'] + pad
        if audio_dur is not None:
            b = min(audio_dur, b)
        out.append({'file': file_name(g), 'lines': g['lines'], 'cut': (round(a, 3), round(b, 3)),
                    'spk': g['spk']})
    return out


def segments_rows(cuts):
    """Produce segments.json rows [[file, firstLine, lastLine], ...] sorted by first line."""
    rows = [[c['file'], c['lines'][0], c['lines'][-1]] for c in cuts]
    rows.sort(key=lambda r: r[1])
    return rows


def wordtimes_for_cuts(cuts, spk_words):
    """Collect whisper words inside each cut into the mix-studio wordtimes schema.

    @param {list[dict]} cuts - cut dicts with keys lines, cut=[a,b], spk (seconds, absolute in source)
    @param {dict[str, list[list]]} spk_words - per-speaker whisper words as [word, start, end] (seconds)
    @returns {dict[str, list[list]]} - keyed by the group's first line number (as string),
        values [word, start, end] relative to the cut file start (seconds) — the exact schema
        mix-studio.py merges into talk.js for karaoke/keyword timing. Fuzzy-grade precision.
    """
    out = {}
    for c in cuts:
        words = spk_words.get(c.get('spk'))
        if not words:
            continue
        a, b = c['cut']
        inside = [[w, round(s - a, 3), round(e - a, 3)]
                  for w, s, e in words
                  if a <= (s + e) / 2 <= b and e > s]
        if inside:
            out[str(c['lines'][0])] = inside
    return out
