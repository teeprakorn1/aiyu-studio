#!/usr/bin/env python3
"""tts_gen.py — synthesize dialogue lines with TTS into vo/*.wav + draft segments.json.

Optional tool, NOT part of the core pipeline: recording or generating voice files by
any other means and writing segments.json by hand remains a first-class workflow.

Workflow:
  1. Write story/tts.json mapping each speaker to a provider+voice, e.g.
       {"defaults": {"provider": "edge", "voice": "th-TH-PremwadeeNeural"},
        "speakers": {"H": {"voice": "th-TH-NiwatNeural"}}}
  2. Run this tool — it synthesizes ONE FILE PER LINE (making the segments mapping
     exact by construction — no alignment anywhere), writes vo/ files per the naming
     convention, a DRAFT story/segments.auto.json, and story/wordtimes.auto.json when
     the provider supplies word timing (tier A providers — enables karaoke subtitles).
  3. Review, rename the drafts to segments.json / wordtimes.json, npm run mix as usual.

Providers: edge (free, no key), elevenlabs, and gemini. Each was verified against the live
service with one Thai sample on 2026-11-27; other voices and models are untested.

Usage:
  py tools/tts-gen/tts_gen.py <project-dir> [--narrator M] [--write] [--force] [--dry-run]
      [--only 3,4,5] [--list-voices [PROVIDER]]
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'engine', 'lib'))

import lib_plan  # noqa: E402
import lib_providers  # noqa: E402
import mix_audio  # noqa: E402

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def fail(msg):
    print(f'tts-gen: error: {msg}', file=sys.stderr)
    sys.exit(1)


def main(argv=None):
    ap = argparse.ArgumentParser(description='synthesize dialogue lines into vo/*.wav + draft segments.json')
    ap.add_argument('project', nargs='?', help='project directory (contains story/dialogue.txt)')
    ap.add_argument('--narrator', default='M', help='narrator speaker id (file naming convention)')
    ap.add_argument('--write', action='store_true', help='write vo/ files and drafts (default: dry-run plan only)')
    ap.add_argument('--force', action='store_true', help='overwrite existing draft files')
    ap.add_argument('--dry-run', action='store_true', help='print the plan and exit (default behavior without --write)')
    ap.add_argument('--only', default='', help='comma-separated line indexes to synthesize (default: all)')
    ap.add_argument('--list-voices', nargs='?', const='', metavar='PROVIDER', help='list providers (no value) or the voices of PROVIDER, then exit')
    args = ap.parse_args(argv)

    if args.list_voices is not None:
        if args.list_voices == '':
            for name, p in sorted(lib_providers.PROVIDERS.items()):
                tag = 'EXPERIMENTAL' if p['experimental'] else 'verified'
                print(f'{name:12s} tier {p["tier"]}  [{tag}]  {p["desc"]}')
            return 0
        try:
            voices = lib_providers.list_voices(args.list_voices)
        except (RuntimeError, ValueError) as exc:
            fail(str(exc))
        for v in voices:
            print(f"{v.get('ShortName', ''):32s} {v.get('Locale', ''):8s} {v.get('Gender', '')}")
        return 0

    if not args.project:
        ap.error('project directory is required (or use --list-voices)')
    proj = os.path.abspath(args.project)
    dialogue_path = os.path.join(proj, 'story', 'dialogue.txt')
    config_path = os.path.join(proj, 'story', 'tts.json')
    for path, label in [(dialogue_path, 'story/dialogue.txt'), (config_path, 'story/tts.json')]:
        if not os.path.exists(path):
            fail(f'{label} not found in {proj}')

    with open(dialogue_path, encoding='utf-8') as f:
        lines = mix_audio.parse_dialogue_text(f.read())
    with open(config_path, encoding='utf-8') as f:
        try:
            cfg = json.load(f)
        except json.JSONDecodeError as exc:
            fail(f'story/tts.json is not valid json: {exc}')

    speakers = {ln['spk'] for ln in lines}
    try:
        resolved, unknown = lib_plan.validate_config(cfg, speakers)
    except ValueError as exc:
        fail(str(exc))
    if unknown:
        print(f'tts-gen: note: tts.json configures unused speakers: {", ".join(unknown)}')

    jobs = lib_plan.build_plan(lines, resolved, args.narrator)
    if args.only:
        wanted = {int(x) for x in args.only.split(',') if x.strip()}
        jobs = [j for j in jobs if j['line'] in wanted]
        if not jobs:
            fail('--only matched no lines')
    if not jobs:
        fail('dialogue.txt has no lines')

    # validate every provider up front — fail before spending a single API call
    used = {}
    for j in jobs:
        if j['provider'] not in used:
            try:
                used[j['provider']] = lib_providers.get_provider(j['provider'])
            except ValueError as exc:
                fail(str(exc))
    for name, p in used.items():
        if p['experimental']:
            print(f'tts-gen: warning: provider {name!r} is EXPERIMENTAL — implemented per API spec, untested live')
        if p['tier'] != 'A':
            print(f'tts-gen: note: provider {name!r} is tier B — no word timing, karaoke subtitles unavailable for its lines')

    print(f'tts-gen: {len(jobs)} lines to synthesize '
          f'({len(used)} provider(s): {", ".join(sorted(used))})')
    for j in jobs:
        print(f"  line {j['line']:>3} [{j['spk']}] {j['provider']}/{j['voice']} -> vo/{j['file']}  {j['txt'][:50]}")

    if not args.write:
        print('\ndry-run — pass --write to synthesize')
        return 0

    vo_dir = os.path.join(proj, 'vo')
    os.makedirs(vo_dir, exist_ok=True)
    results, failures = {}, []
    for k, j in enumerate(jobs, 1):
        out = os.path.join(vo_dir, j['file'])
        provider = used[j['provider']]
        try:
            r = provider['fn'](j['txt'], j['voice'], j['rate'], out)
        except Exception as exc:
            failures.append((j['line'], str(exc)[:200]))
            print(f'  [{k}/{len(jobs)}] line {j["line"]} FAILED: {str(exc)[:120]}')
            continue
        results[j['line']] = r.get('words')
        wcount = len(r['words']) if r.get('words') else 0
        print(f'  [{k}/{len(jobs)}] line {j["line"]} ok ({wcount} words timed)')

    synthesized = [j for j in jobs if j['line'] in results]
    if synthesized:
        seg_payload = lib_plan.segments_payload(
            [j for j in lib_plan.build_plan(lines, resolved, args.narrator) if j['line'] in results]
            if args.only else lib_plan.build_plan(lines, resolved, args.narrator))
        if args.only:
            print('tts-gen: note: --only run — segments draft covers ONLY the synthesized lines; merge by hand')
        _, skipped = lib_plan.write_draft(
            os.path.join(proj, 'story', 'segments.auto.json'), seg_payload, args.force)
        print(('segments.auto.json exists — skipped (use --force)' if skipped
               else 'draft story/segments.auto.json written'))

        wt = lib_plan.wordtimes_payload(results)
        if wt:
            _, wskipped = lib_plan.write_draft(
                os.path.join(proj, 'story', 'wordtimes.auto.json'), wt, args.force)
            print(('wordtimes.auto.json exists — skipped (use --force)' if wskipped
                   else f'draft story/wordtimes.auto.json written ({len(wt)} lines timed) — enables karaoke mode'))

    if failures:
        print(f'\ntts-gen: {len(failures)} line(s) failed:', file=sys.stderr)
        for line, err in failures:
            print(f'  line {line}: {err}', file=sys.stderr)
        return 1
    print(f'\ntts-gen: done — {len(synthesized)}/{len(jobs)} lines synthesized')
    print('next: review, rename drafts to segments.json/wordtimes.json, then npm run mix')
    return 0


if __name__ == '__main__':
    sys.exit(main())
