#!/usr/bin/env python3
"""auto_segment.py — draft segments.json + sliced vo/*.wav from long single-speaker recordings.

Optional tool, NOT part of the core pipeline: the manual workflow (generate/record
per-segment voice files, write segments.json by hand) remains first-class and untouched.

Workflow:
  1. Record or generate ONE long take per speaker, reading exactly their own lines in
     dialogue order, at natural pace. Name it raw-vo/<spk>.wav (M.wav, J.wav, ...).
  2. Run this tool — it transcribes with faster-whisper, fuzzy-aligns each dialogue
     line to the transcript, slices the audio into vo/ per the naming convention, and
     writes a DRAFT story/segments.auto.json with a per-line confidence report.
  3. REVIEW the report — low-confidence lines are normal with Thai ASR. Fix boundaries
     or re-record problem lines, rename segments.auto.json to segments.json, then
     npm run mix as usual. Nothing here is magic: treat the output as a draft.

Usage:
  py tools/auto-segment/auto_segment.py <project-dir> [--model small] [--lang th]
      [--pad 0.08] [--group-max 25] [--write] [--force] [--dry-run]
"""
import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'engine', 'lib'))

import lib_align  # noqa: E402
import mix_audio  # noqa: E402

AUDIO_EXTS = ('.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac')


def fail(msg):
    print(f'auto-segment: error: {msg}', file=sys.stderr)
    sys.exit(1)


def load_whisper(model_size, lang):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        fail('faster-whisper is not installed. This tool is optional and keeps its own '
             'dependencies: pip install -r tools/auto-segment/requirements.txt')
    model = WhisperModel(model_size, device='cpu', compute_type='int8')
    return model, lang


def transcribe_words(model, path, lang):
    """Word-level timestamps from faster-whisper, flattened to (text, start, end)."""
    segments, _info = model.transcribe(path, word_timestamps=True, language=lang)
    words = []
    for seg in segments:
        for w in (seg.words or []):
            words.append((w.word, float(w.start), float(w.end)))
    if not words:
        fail(f'no words transcribed from {path} — silent or unreadable audio?')
    return words


def ffmpeg_dur(path):
    try:
        out = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
            capture_output=True, text=True, check=True)
        return float(out.stdout.strip())
    except Exception as exc:
        fail(f'ffprobe cannot read duration of {path}: {exc}')


def slice_audio(src, dst, a, b):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    r = subprocess.run(
        ['ffmpeg', '-y', '-v', 'error', '-i', src, '-ss', f'{a:.3f}', '-to', f'{b:.3f}',
         '-ac', '1', '-ar', '24000', dst],
        capture_output=True, text=True)
    if r.returncode != 0:
        fail(f'ffmpeg failed slicing {os.path.basename(dst)}: {r.stderr.strip()[-300:]}')


def main():
    ap = argparse.ArgumentParser(description='draft segments.json + slice vo files from long per-speaker recordings')
    ap.add_argument('project', nargs='?', default='.', help='project directory (default: cwd)')
    ap.add_argument('--model', default='small', help='faster-whisper model size (default: small)')
    ap.add_argument('--lang', default=None, help='spoken language code, e.g. th (default: auto-detect)')
    ap.add_argument('--pad', type=float, default=0.08, help='seconds of padding around each cut (default: 0.08)')
    ap.add_argument('--group-max', type=float, default=25.0, help='max seconds per narrator group (default: 25)')
    ap.add_argument('--write', action='store_true', help='write story/segments.json instead of segments.auto.json')
    ap.add_argument('--force', action='store_true', help='allow overwriting an existing target segments file')
    ap.add_argument('--dry-run', action='store_true', help='align and report only — do not slice audio or write files')
    args = ap.parse_args()

    proj = os.path.abspath(args.project)
    dialogue_path = os.path.join(proj, 'story', 'dialogue.txt')
    raw_dir = os.path.join(proj, 'raw-vo')
    if not os.path.isfile(dialogue_path):
        fail(f'no story/dialogue.txt in {proj}')
    if not os.path.isdir(raw_dir):
        fail(f'no raw-vo/ directory in {proj} — drop one long recording per speaker as raw-vo/<spk>.wav')

    lines = mix_audio.parse_dialogue_text(open(dialogue_path, encoding='utf-8').read())
    by_spk = {}
    for ln in lines:
        by_spk.setdefault(ln['spk'], []).append(ln)

    raws = {}
    for f in sorted(os.listdir(raw_dir)):
        stem, ext = os.path.splitext(f)
        if ext.lower() not in AUDIO_EXTS:
            continue
        if len(stem) != 1:
            fail(f'raw-vo/{f}: file name must be exactly the one-character speaker id (e.g. M.wav)')
        raws[stem] = os.path.join(raw_dir, f)
    if not raws:
        fail(f'raw-vo/ has no audio files ({", ".join(AUDIO_EXTS)})')
    missing_spk = [spk for spk in by_spk if spk not in raws]
    extra_spk = [spk for spk in raws if spk not in by_spk]
    if missing_spk:
        fail(f'speakers in dialogue.txt without a raw recording: {missing_spk} — record them or fix spk ids')
    if extra_spk:
        print(f'auto-segment: warning: raw-vo files for unknown speakers ignored: {extra_spk}', file=sys.stderr)

    model = None
    all_cuts = []
    spk_words = {}
    report = []
    low_conf = []
    unmatched = []
    for spk in sorted(raws):
        if spk not in by_spk:
            continue
        spk_lines = by_spk[spk]
        print(f'auto-segment: transcribing speaker {spk} ({len(spk_lines)} lines) — this can take minutes on CPU…')
        if model is None:
            model, lang = load_whisper(args.model, args.lang)
        words = transcribe_words(model, raws[spk], lang)
        spk_words[spk] = words
        aligned = lib_align.align_lines(words, [ln['txt'] for ln in spk_lines])
        # realign indices: align_lines positions correspond to this speaker's line subset
        for a, ln in zip(aligned, spk_lines):
            a['line'] = ln['i']
            report.append({'line': ln['i'], 'spk': spk, 'conf': a['conf'], 'txt': ln['txt'][:60]})
            if a['start'] is None:
                unmatched.append(ln['i'])
            elif a['conf'] < 0.6:
                low_conf.append(ln['i'])
        groups = lib_align.group_aligned(aligned, spk, group_max=args.group_max)
        dur = ffmpeg_dur(raws[spk])
        for c in lib_align.cut_ranges(groups, pad=args.pad, audio_dur=dur):
            c['src'] = raws[spk]
            all_cuts.append(c)

    print('\nauto-segment: per-line confidence')
    for r in sorted(report, key=lambda x: x['line']):
        flag = '  ✗ UNMATCHED' if r['line'] in unmatched else ('  ⚠ low' if r['line'] in low_conf else '')
        print(f"  L{r['line']:>3} [{r['spk']}] conf {r['conf']:.2f}{flag}  {r['txt']}")

    rows = lib_align.segments_rows(all_cuts)
    n_lines = len(lines)
    try:
        mix_audio.validate_segments(rows, n_lines)
        coverage_ok = True
    except ValueError as exc:
        coverage_ok = False
        print(f'\nauto-segment: coverage incomplete — {exc}', file=sys.stderr)

    if unmatched or low_conf:
        print(f'\nauto-segment: {len(unmatched)} unmatched, {len(low_conf)} low-confidence lines — '
              'treat the draft as a STARTING POINT: review boundaries in preview.html after mixing, '
              'or re-record problem lines and re-run.', file=sys.stderr)

    if args.dry_run:
        print('\nauto-segment: dry run — no files written')
        return

    target = os.path.join(proj, 'story', 'segments.json' if args.write else 'segments.auto.json')
    wt_target = os.path.join(proj, 'story', 'wordtimes.auto.json')
    if os.path.exists(target) and not args.force:
        fail(f'{os.path.basename(target)} already exists — pass --force to overwrite (never clobbering by default)')

    vo_dir = os.path.join(proj, 'vo')
    for c in all_cuts:
        dst = os.path.join(vo_dir, c['file'])
        slice_audio(c['src'], dst, *c['cut'])
        print(f"auto-segment: cut {c['file']}  {c['cut'][0]:.2f}–{c['cut'][1]:.2f}s  lines {c['lines'][0]}–{c['lines'][-1]}")

    # wordtimes draft: whisper words inside each cut, relative to the cut file start,
    # keyed by the group's first line — the exact schema mix-studio.py merges into talk.js
    # for karaoke/keyword timing. Fuzzy-grade: good enough for highlight/reveal beats.
    wt = lib_align.wordtimes_for_cuts(all_cuts, spk_words)
    if wt:
        if os.path.exists(wt_target) and not args.force:
            print('auto-segment: wordtimes.auto.json exists — skipped (use --force)')
        else:
            with open(wt_target, 'w', encoding='utf-8', newline='\n') as f:
                json.dump(wt, f, ensure_ascii=False, indent=2)
                f.write('\n')
            print(f'auto-segment: wrote story/wordtimes.auto.json ({len(wt)} groups timed) — rename to wordtimes.json for karaoke/keyword beats')

    settings = {'tempo': 1.0, 'gap': 0.15, 'trimThresh': 500, 'lineGap': 0.06}
    payload = {'settings': settings, 'segments': rows}
    with open(target, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'\nauto-segment: wrote {os.path.relpath(target, proj)}'
          + ('' if coverage_ok else '  ⚠ INCOMPLETE COVERAGE — fix before mixing')
          + (f'\nnext: review it, then mv to story/segments.json and run: npm run mix' if not args.write else
             f'\nnext: npm run mix, then check line timing in preview.html'))
    if not coverage_ok:
        sys.exit(2)


if __name__ == '__main__':
    main()
