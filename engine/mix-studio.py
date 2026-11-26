#!/usr/bin/env python3
# mix-studio.py — builds talk.js + narration.wav from voice files in vo/ per segments.json
#   python mix-studio.py           → all files present: real timings · missing files: stub talk.js (estimated) for scene work
#   python mix-studio.py --stub    → force stub mode
#   python mix-studio.py --dialogue=xxx.txt --segments=yyy.json   → override inputs
#
# story/dialogue.txt format:  index|spk|text   (index runs 0..N-1, spk: M=narrator, other letters=characters)
# story/segments.json format: {"settings": {...}, "segments": [["file.wav", firstLine, lastLine], ...]}
#   segments must cover lines 0..N-1 in order — no overlaps, no gaps
import array, json, os, subprocess, sys

try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

# project root — engine scripts always run from the project root (npm scripts guarantee it)
HERE = os.getcwd()
VO = os.path.join(HERE, 'vo')

def arg(name, default):
    for a in sys.argv[1:]:
        if a.startswith(f'--{name}='):
            return a.split('=', 1)[1]
    return default

DIALOGUE = os.path.join(HERE, arg('dialogue', 'story/dialogue.txt'))
SEGMENTS_FILE = os.path.join(HERE, arg('segments', 'story/segments.json'))

spec = json.load(open(SEGMENTS_FILE, encoding='utf-8'))
st = spec.get('settings', {})
SEGMENTS = [tuple(s) for s in spec['segments']]
GAP = st.get('gap', 0.15)           # seconds of silence between voice files
TEMPO = st.get('tempo', 1.15)       # speed up the whole track (ffmpeg atempo, pitch preserved) — everything rescales because it all reads talk.js
TRIM_THRESH = st.get('trimThresh', 500)   # edge-silence trim threshold (amplitude out of 32768)
LINE_GAP = st.get('lineGap', 0.06)  # intra-file pause weighting (combined with char-weight)

lines = []
for row in open(DIALOGUE, encoding='utf-8'):
    row = row.strip()
    if not row: continue
    i, spk, txt = row.split('|', 2)
    lines.append({'i': int(i), 'spk': spk, 'txt': txt})
N = len(lines)
assert [l['i'] for l in lines] == list(range(N)), f'dialogue index broken: must run 0..{N-1}'
covered = [i for _, a, b in SEGMENTS for i in range(a, b + 1)]
assert covered == list(range(N)), f'segments must cover 0..{N-1} in order (currently covering {len(covered)} of {N} lines)'

have = [os.path.join(VO, name) if os.path.exists(os.path.join(VO, name)) else None for name, _, _ in SEGMENTS]
stub = '--stub' in sys.argv or not all(have)
if not stub:
    print('real mode: all voice files present')
else:
    missing = [name for (name, _, _), p in zip(SEGMENTS, have) if not p]
    print(f'stub mode (missing {len(missing)} files: {missing[:8]}{"..." if len(missing) > 8 else ""})')

def pcm_of(path):
    return subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '24000', '-'],
                          capture_output=True, check=True).stdout

def trim_edges(raw, thresh=TRIM_THRESH, pad_ms=60):
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

def atempo_pcm(raw, tempo):
    if abs(tempo - 1.0) < 1e-6: return raw
    return subprocess.run(['ffmpeg', '-v', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', '-',
                           '-af', f'atempo={tempo}', '-f', 's16le', '-ac', '1', '-ar', '24000', '-'],
                          input=raw, capture_output=True, check=True).stdout

t = 0.0
talk_lines = []
pcm_all = b'' if not stub else None

for k, (name, a, b) in enumerate(SEGMENTS):
    grp = lines[a:b + 1]
    if stub:
        gdur = sum(len(l['txt']) for l in grp) / 12.5  # ~12.5 chars/sec estimate for scene work
    else:
        raw = atempo_pcm(trim_edges(pcm_of(have[k])), TEMPO)
        gdur = len(raw) / 48000
    wsum = sum(len(l['txt']) for l in grp) + LINE_GAP * 40 * (len(grp) - 1)
    cur = t
    for n, l in enumerate(grp):
        dur = gdur * (len(l['txt']) + (LINE_GAP * 40 if n else 0)) / wsum
        env = [0] * 30
        if not stub:
            # envelope of this line slice (30 points) — drives character mouths
            off = int((cur - t) * 48000) // 2 * 2
            seg = raw[off:off + int(dur * 48000) // 2 * 2]
            if seg:
                smp = array.array('h'); smp.frombytes(seg)
                w = max(1, len(smp) // 30)
                env = [min(1.0, (sum(s * s for s in smp[i * w:(i + 1) * w]) / max(1, len(smp[i * w:(i + 1) * w]))) ** .5 / 9000) for i in range(30)]
        talk_lines.append({'i': l['i'], 'spk': l['spk'], 't0': round(cur, 3), 'dur': round(dur, 3), 'txt': l['txt'], 'env': env})
        cur += dur
    if not stub:
        pcm_all += raw + b'\x00' * (int(GAP * 48000) // 2 * 2)
    t = cur + GAP

def wave_peaks(raw, buckets=2048):
    # fixed-resolution peak envelope for preview.html's timeline — strided sampling
    # caps the cost regardless of length; visual peaks don't need every sample
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

dur = talk_lines[-1]['t0'] + talk_lines[-1]['dur'] + 0.8
talk = {'dur': round(dur, 2), 'lines': talk_lines}
if not stub:
    talk['wave'] = wave_peaks(pcm_all)
    talk['waveDur'] = round(len(pcm_all) / 48000, 2)
with open(os.path.join(HERE, 'talk.js'), 'w', encoding='utf-8') as f:
    f.write('const TALK=' + json.dumps(talk, ensure_ascii=False) + ';\n')
print(f'talk.js -> {len(talk_lines)} lines, dur={dur:.1f}s ({"STUB" if stub else "REAL"})')

if not stub:
    import wave
    with wave.open(os.path.join(HERE, 'narration.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
        w.writeframes(pcm_all)
    print(f'narration.wav -> {len(pcm_all) / 48000:.1f}s')
