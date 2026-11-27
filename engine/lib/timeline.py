"""Timeline planning for mix-studio: dialogue lines onto talk.js time, narration assembly, karaoke word merge."""
from .mix_audio import envelope_from_pcm

TAIL_SEC = 0.8
STUB_CHARS_PER_SEC = 12.5
BYTES_PER_SEC = 48000


def _silence(seconds):
    return b'\x00' * (int(seconds * BYTES_PER_SEC) // 2 * 2)


def plan_timeline(lines, segments, settings, clips=None):
    """Lay dialogue lines on the timeline and assemble the narration.

    @param {list[dict]} lines - parsed dialogue rows (i, spk, txt)
    @param {list[tuple]} segments - validated (file, firstLine, lastLine) rows
    @param {dict} settings - validated mix settings (gap seconds, lineGap weight)
    @param {list[tuple[bytes, float]]|None} clips - per segment: (s16le/24kHz mono PCM after trim and tempo, source-time lead in seconds removed by the trim); None selects stub timing estimated from character counts
    @returns {dict} talk_lines (talk.js line records), windows [(first, last, startSec, leadSec)], narration (PCM bytes, None in stub mode), t_end (seconds where the last line ends)
    """
    gap, line_gap = settings['gap'], settings['lineGap']
    stub = clips is None
    t = 0.0
    talk_lines, windows, parts = [], [], []
    for k, (_, a, b) in enumerate(segments):
        grp = lines[a:b + 1]
        if stub:
            raw, lead = None, 0.0
            gdur = sum(len(l['txt']) for l in grp) / STUB_CHARS_PER_SEC
        else:
            raw, lead = clips[k]
            gdur = len(raw) / BYTES_PER_SEC
        wsum = sum(len(l['txt']) for l in grp) + line_gap * 40 * (len(grp) - 1)
        windows.append((a, b, t, lead))
        cur = t
        for n_line, l in enumerate(grp):
            dur = gdur * (len(l['txt']) + (line_gap * 40 if n_line else 0)) / wsum
            env = [0] * 30
            if not stub:
                off = int((cur - t) * BYTES_PER_SEC) // 2 * 2
                env = envelope_from_pcm(raw[off:off + int(dur * BYTES_PER_SEC) // 2 * 2])
            talk_lines.append({'i': l['i'], 'spk': l['spk'], 't0': round(cur, 3), 'dur': round(dur, 3), 'txt': l['txt'], 'env': env})
            cur += dur
        if not stub:
            parts.append(raw)
            if k < len(segments) - 1:
                parts.append(_silence(gap))
        t = cur + gap
    last = talk_lines[-1]
    return {
        'talk_lines': talk_lines,
        'windows': windows,
        'narration': None if stub else b''.join(parts),
        't_end': last['t0'] + last['dur'],
    }


def apply_wordtimes(talk_lines, windows, wordtimes, tempo):
    """Attach karaoke word timing to talk lines.

    Word times in wordtimes.json are relative to each segment's source audio, so the trimmed lead is removed before the tempo scaling.
    @param {list[dict]} talk_lines - talk.js line records, updated in place with a words list
    @param {list[tuple]} windows - (first, last, startSec, leadSec) per segment from plan_timeline
    @param {dict} wordtimes - {"lineIndex": [[word, startSec, endSec], ...]}
    @param {float} tempo - atempo factor applied to the segment audio
    @returns {int} number of lines that received word timing
    """
    if not isinstance(wordtimes, dict):
        raise ValueError('wordtimes.json: expected an object mapping line index to [word, start, end] rows')
    abs_words = []
    for a, b, start, lead in windows:
        for key, rows in wordtimes.items():
            if not a <= _line_index(key) <= b:
                continue
            for word, ws, we in _word_rows(key, rows):
                abs_words.append((word, start + max(0.0, (ws - lead) / tempo), start + max(0.0, (we - lead) / tempo)))
    merged = 0
    for tl in talk_lines:
        lo, hi = tl['t0'], tl['t0'] + tl['dur']
        mine = [(w, s, e) for w, s, e in abs_words if lo <= (s + e) / 2 < hi]
        if mine:
            tl['words'] = [{'w': w, 't0': round(s, 3), 'dur': round(e - s, 3)} for w, s, e in mine]
            merged += 1
    return merged


def _line_index(key):
    try:
        return int(key)
    except (TypeError, ValueError):
        raise ValueError(f'wordtimes.json: key {key!r} is not a line index')


def _word_rows(key, rows):
    if not isinstance(rows, list):
        raise ValueError(f'wordtimes.json: line {key} must be a list of [word, start, end] rows')
    out = []
    for row in rows:
        if not isinstance(row, list) or len(row) != 3 or not all(isinstance(x, (int, float)) for x in row[1:]):
            raise ValueError(f'wordtimes.json: line {key} has a malformed [word, start, end] row: {row!r}')
        out.append((str(row[0]), float(row[1]), float(row[2])))
    return out
