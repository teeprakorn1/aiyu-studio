#!/usr/bin/env python3
# mix-studio.py — builds talk.js + narration.wav from voice files in vo/ per segments.json
#   python mix-studio.py           → all files present: real timings · missing files: stub talk.js (estimated) for scene work
#   python mix-studio.py --stub    → force stub mode
#   python mix-studio.py --dialogue=xxx.txt --segments=yyy.json   → override inputs
#
# story/dialogue.txt format:  index|spk|text   (index runs 0..N-1, spk: M=narrator, other letters=characters)
# story/segments.json format: {"settings": {...}, "segments": [["file.wav", firstLine, lastLine], ...]}
#   segments must cover lines 0..N-1 in order — no overlaps, no gaps
import argparse, json, os, subprocess, sys

from lib.mix_audio import (
    parse_dialogue_text, validate_segments, validate_settings,
    trim_edges, envelope_from_pcm, wave_peaks, talk_js_payload,
)

try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

# project root — engine scripts always run from the project root (npm scripts guarantee it)
HERE = os.getcwd()
VO = os.path.join(HERE, 'vo')


def pcm_of(path):
    return subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '24000', '-'],
                          capture_output=True, check=True).stdout


def atempo_pcm(raw, tempo):
    if abs(tempo - 1.0) < 1e-6: return raw
    return subprocess.run(['ffmpeg', '-v', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', '-',
                           '-af', f'atempo={tempo}', '-f', 's16le', '-ac', '1', '-ar', '24000', '-'],
                          input=raw, capture_output=True, check=True).stdout


def resolve_input(path):
    return path if os.path.isabs(path) else os.path.join(HERE, path)


def build(args):
    dialogue_path = resolve_input(args.dialogue)
    segments_path = resolve_input(args.segments)
    with open(dialogue_path, encoding='utf-8') as f:
        lines = parse_dialogue_text(f.read())
    with open(segments_path, encoding='utf-8') as f:
        spec = json.load(f)
    if not isinstance(spec, dict) or 'segments' not in spec:
        raise ValueError('segments.json: expected an object with a segments list')

    n = len(lines)
    settings = validate_settings(spec.get('settings', {}))
    segments = validate_segments(spec['segments'], n)
    gap = settings['gap']           # seconds of silence between voice files
    tempo = settings['tempo']       # whole-track ffmpeg atempo; talk.js rescales with it
    trim_thresh = settings['trimThresh']
    line_gap = settings['lineGap']  # intra-file pause weighting

    have = []
    for name, _, _ in segments:
        p = os.path.join(VO, name)
        have.append(p if os.path.exists(p) else None)
    stub = args.stub or not all(have)
    if not stub:
        print('real mode: all voice files present')
    else:
        missing = [name for (name, _, _), p in zip(segments, have) if not p]
        print(f'stub mode (missing {len(missing)} files: {missing[:8]}{"..." if len(missing) > 8 else ""})')

    t = 0.0
    talk_lines = []
    pcm_all = b'' if not stub else None

    for k, (name, a, b) in enumerate(segments):
        grp = lines[a:b + 1]
        if stub:
            gdur = sum(len(l['txt']) for l in grp) / 12.5  # ~12.5 chars/sec estimate for scene work
        else:
            raw = atempo_pcm(trim_edges(pcm_of(have[k]), trim_thresh), tempo)
            gdur = len(raw) / 48000
        wsum = sum(len(l['txt']) for l in grp) + line_gap * 40 * (len(grp) - 1)
        cur = t
        for n_line, l in enumerate(grp):
            dur = gdur * (len(l['txt']) + (line_gap * 40 if n_line else 0)) / wsum
            env = [0] * 30
            if not stub:
                # envelope of this line slice (30 points) — drives character mouths
                off = int((cur - t) * 48000) // 2 * 2
                seg = raw[off:off + int(dur * 48000) // 2 * 2]
                env = envelope_from_pcm(seg)
            talk_lines.append({'i': l['i'], 'spk': l['spk'], 't0': round(cur, 3), 'dur': round(dur, 3), 'txt': l['txt'], 'env': env})
            cur += dur
        if not stub:
            pcm_all += raw + b'\x00' * (int(gap * 48000) // 2 * 2)
        t = cur + gap

    dur = talk_lines[-1]['t0'] + talk_lines[-1]['dur'] + 0.8
    talk = {'dur': round(dur, 2), 'lines': talk_lines}
    if not stub:
        talk['wave'] = wave_peaks(pcm_all)
        talk['waveDur'] = round(len(pcm_all) / 48000, 2)
    with open(os.path.join(HERE, 'talk.js'), 'w', encoding='utf-8') as f:
        f.write(talk_js_payload(talk))
    print(f'talk.js -> {len(talk_lines)} lines, dur={dur:.1f}s ({"STUB" if stub else "REAL"})')

    if not stub:
        import wave
        with wave.open(os.path.join(HERE, 'narration.wav'), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
            w.writeframes(pcm_all)
        print(f'narration.wav -> {len(pcm_all) / 48000:.1f}s')


def main(argv=None):
    parser = argparse.ArgumentParser(description='build talk.js + narration.wav from story/dialogue.txt and story/segments.json')
    parser.add_argument('--stub', action='store_true', help='force estimated timings without voice files')
    parser.add_argument('--dialogue', default='story/dialogue.txt', help='dialogue input path (default: story/dialogue.txt)')
    parser.add_argument('--segments', default='story/segments.json', help='segments input path (default: story/segments.json)')
    args = parser.parse_args(argv)
    try:
        build(args)
    except subprocess.CalledProcessError as e:
        detail = (e.stderr or b'').decode('utf-8', errors='replace').strip()
        print(f'mix-studio error: ffmpeg failed: {detail or e}', file=sys.stderr)
        return 2
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as e:
        print(f'mix-studio error: {e}', file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
