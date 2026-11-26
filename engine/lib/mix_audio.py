"""Pure parsing, validation, and PCM helpers for engine/mix-studio.py."""
import array, json, math, os


def parse_dialogue_text(text):
    """Parse index|spk|text dialogue rows with validation."""
    lines = []
    for lineno, row in enumerate(text.splitlines(), 1):
        row = row.strip()
        if not row:
            continue
        parts = row.split('|', 2)
        if len(parts) != 3:
            raise ValueError(f'dialogue line {lineno}: expected index|spk|text')
        raw_i, spk, txt = parts
        try:
            i = int(raw_i)
        except ValueError as exc:
            raise ValueError(f'dialogue line {lineno}: index must be an integer') from exc
        if not spk:
            raise ValueError(f'dialogue line {lineno}: speaker must not be empty')
        if not txt.strip():
            raise ValueError(f'dialogue line {lineno}: text must not be empty')
        lines.append({'i': i, 'spk': spk, 'txt': txt})
    n = len(lines)
    if not n:
        raise ValueError('dialogue is empty')
    want = list(range(n))
    got = [l['i'] for l in lines]
    if got != want:
        raise ValueError(f'dialogue index broken: must run 0..{n - 1} in order')
    return lines


def validate_segments(raw, n):
    """Validate ordered full-line coverage and normalize rows to tuples."""
    if not isinstance(raw, list) or not raw:
        raise ValueError('segments.json: segments must be a non-empty list')
    out = []
    for idx, row in enumerate(raw):
        if not isinstance(row, list) or len(row) != 3:
            raise ValueError(f'segments.json row {idx}: expected [file.wav, firstLine, lastLine]')
        name, a, b = row
        validate_voice_name(name)
        if not isinstance(a, int) or not isinstance(b, int) or a < 0 or b < a:
            raise ValueError(f'segments.json row {idx}: invalid line range {a}..{b}')
        out.append((name, a, b))
    covered = [i for _, a, b in out for i in range(a, b + 1)]
    if covered != list(range(n)):
        raise ValueError(f'segments must cover lines 0..{n - 1} in order without overlaps or gaps')
    return out


def finite_number(settings, key, default, lo, hi):
    v = settings.get(key, default)
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
        raise ValueError(f'settings.{key} must be a finite number')
    if not lo <= v <= hi:
        raise ValueError(f'settings.{key} must be in range {lo}..{hi}')
    return float(v)


def validate_settings(settings):
    """Validate optional mix settings and return normalized values."""
    if settings is None:
        settings = {}
    if not isinstance(settings, dict):
        raise ValueError('segments.json: settings must be an object')
    return {
        'gap': finite_number(settings, 'gap', 0.15, 0, 5),
        'tempo': finite_number(settings, 'tempo', 1.15, 0.5, 2.0),
        'trimThresh': finite_number(settings, 'trimThresh', 500, 1, 32768),
        'lineGap': finite_number(settings, 'lineGap', 0.06, 0, 1),
    }


def validate_voice_name(name):
    """Voice files are direct children of vo/ — no paths or traversal."""
    if not isinstance(name, str) or not name.strip():
        raise ValueError('voice file name must be a non-empty string')
    if os.path.isabs(name) or '/' in name or '\\' in name or name in ('.', '..'):
        raise ValueError(f'voice file must be a file name inside vo/, not a path: {name}')


def trim_edges(raw, thresh=500, pad_ms=60):
    """Trim edge silence from s16le/24kHz/mono PCM; keep 60ms pads by default."""
    smp = array.array('h'); smp.frombytes(raw)
    n = len(smp); win = 240
    def loud(i):
        return max(abs(x) for x in smp[i:i + win]) if i + win <= n else 0
    h = 0
    while h + win < n * 0.6 and loud(h) < thresh: h += win
    h = max(0, h - int(pad_ms * 24))
    tp = n - win
    while tp > n * 0.4 and loud(tp) < thresh: tp -= win
    tp = min(n, tp + win + int(pad_ms * 24))
    if tp - h < n // 3: return raw
    out = array.array('h'); out.extend(smp[h:tp])
    return out.tobytes()


def envelope_from_pcm(raw, buckets=30):
    """RMS envelope normalized for mouth openness, from s16le/24kHz/mono PCM."""
    smp = array.array('h'); smp.frombytes(raw)
    if not smp:
        return [0] * buckets
    w = max(1, len(smp) // buckets)
    return [
        min(1.0, (sum(s * s for s in smp[i * w:(i + 1) * w]) / max(1, len(smp[i * w:(i + 1) * w]))) ** .5 / 9000)
        for i in range(buckets)
    ]


def wave_peaks(raw, buckets=2048):
    """Fixed-resolution peak envelope for preview.html's timeline."""
    smp = array.array('h'); smp.frombytes(raw)
    n = len(smp)
    if not n: return []
    w = max(1, n // buckets)
    stride = max(1, w // 400)
    out = []
    for i in range(buckets):
        seg = smp[i * w:(i + 1) * w:stride]
        if not seg: break
        out.append(round(min(1.0, max(abs(x) for x in seg) / 32768), 2))
    return out

def talk_js_payload(talk):
    """Serialize TALK as classic-script JavaScript without allowing </script> breakout."""
    return 'const TALK=' + json.dumps(talk, ensure_ascii=False).replace('</', '<\\/') + ';\n'
