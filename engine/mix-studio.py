#!/usr/bin/env python3
# mix-studio.py — builds talk.js + narration.wav from voice files in vo/ per segments.json
#   python mix-studio.py           → all files present: real timings · missing files: stub talk.js (estimated) for scene work
#   python mix-studio.py --stub    → force stub mode
#   python mix-studio.py --dialogue=xxx.txt --segments=yyy.json   → override inputs
#
# story/dialogue.txt format:  index|spk|text   (index runs 0..N-1, spk: one letter or digit, M=narrator)
# story/segments.json format: {"settings": {...}, "segments": [["file.wav", firstLine, lastLine], ...]}
#   segments must cover lines 0..N-1 in order — no overlaps, no gaps
import argparse, json, os, subprocess, sys, wave

from lib.exec_path import find_executable
from lib.mix_audio import (
    parse_dialogue_text, validate_segments, validate_settings,
    trim_edges_with_lead, wave_peaks, talk_js_payload,
)
from lib.timeline import TAIL_SEC, apply_wordtimes, plan_timeline

try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

# project root — engine scripts always run from the project root (npm scripts guarantee it)
HERE = os.getcwd()
VO = os.path.join(HERE, 'vo')


def pcm_of(path):
    return subprocess.run([find_executable('ffmpeg'), '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '24000', '-'],
                          capture_output=True, check=True).stdout


def atempo_pcm(raw, tempo):
    if abs(tempo - 1.0) < 1e-6: return raw
    return subprocess.run([find_executable('ffmpeg'), '-v', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', '-',
                           '-af', f'atempo={tempo}', '-f', 's16le', '-ac', '1', '-ar', '24000', '-'],
                          input=raw, capture_output=True, check=True).stdout


def tempo_clip(path, trim_thresh, tempo):
    trimmed, lead = trim_edges_with_lead(pcm_of(path), trim_thresh)
    return atempo_pcm(trimmed, tempo), lead


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

    settings = validate_settings(spec.get('settings', {}))
    segments = validate_segments(spec['segments'], len(lines))
    have = [os.path.join(VO, name) if os.path.exists(os.path.join(VO, name)) else None for name, _, _ in segments]
    stub = args.stub or not all(have)
    if not stub:
        print('real mode: all voice files present')
    else:
        missing = [name for (name, _, _), p in zip(segments, have) if not p]
        print(f'stub mode (missing {len(missing)} files: {missing[:8]}{"..." if len(missing) > 8 else ""})')

    clips = None if stub else [tempo_clip(p, settings['trimThresh'], settings['tempo']) for p in have]
    plan = plan_timeline(lines, segments, settings, clips)
    talk_lines = plan['talk_lines']

    wt_path = os.path.join(HERE, 'story', 'wordtimes.json')
    if not stub and os.path.exists(wt_path):
        with open(wt_path, encoding='utf-8') as f:
            merged = apply_wordtimes(talk_lines, plan['windows'], json.load(f), settings['tempo'])
        if merged:
            print(f'wordtimes.json -> karaoke timing merged into {merged}/{len(talk_lines)} lines')

    talk = {'dur': round(plan['t_end'] + TAIL_SEC, 2), 'lines': talk_lines}
    if not stub:
        talk['wave'] = wave_peaks(plan['narration'])
        talk['waveDur'] = round(len(plan['narration']) / 48000, 2)
    with open(os.path.join(HERE, 'talk.js'), 'w', encoding='utf-8') as f:
        f.write(talk_js_payload(talk))
    print(f'talk.js -> {len(talk_lines)} lines, dur={talk["dur"]:.1f}s ({"STUB" if stub else "REAL"})')

    if not stub:
        with wave.open(os.path.join(HERE, 'narration.wav'), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
            w.writeframes(plan['narration'])
        print(f'narration.wav -> {len(plan["narration"]) / 48000:.1f}s')


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
