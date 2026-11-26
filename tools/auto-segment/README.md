# tools/auto-segment — draft segments.json from long recordings (optional)

**This tool is optional.** The manual workflow — generate or record per-segment voice
files, write `story/segments.json` by hand — remains a first-class, fully supported path
and is completely untouched by this tool's existence. auto-segment is for the other
workflow: you have (or prefer) **one long recording per speaker** and want the machine
to do the splitting bookkeeping.

## What it does

```
raw-vo/M.wav  (you read all narrator lines in order, natural pace)
raw-vo/J.wav  (you read all of character J's lines in order)
      │
      ▼  py tools/auto-segment/auto_segment.py path/to/project
vo/n000-004.wav, vo/c015_J.wav, …   sliced per the production naming convention
story/segments.auto.json            DRAFT mapping — never overwrites without --force
+ per-line confidence report on stdout
```

faster-whisper transcribes each long file with word timestamps; every dialogue line is
fuzzy-aligned to the transcript (character-level, Thai-aware — Thai vowel/tone marks are
kept as matching signal); aligned lines are grouped (characters one file per line,
narrator in ≤ 25 s bundles) and sliced with ffmpeg.

## What it is NOT — read this before trusting it

- **A draft generator, not auto-magic.** Thai ASR makes mistakes, and fuzzy alignment
  follows the audio, not your intentions. The tool prints per-line confidence and exits
  non-zero when coverage is incomplete. Expect to review boundaries in `preview.html`
  after mixing and fix a handful of lines by hand — that is still hours less than
  splitting everything manually.
- **Not part of the pipeline.** Nothing in `engine/` or `template/` depends on it.
  Projects are fully producible without it; it is never scaffolded into projects.

## Setup (isolated from the pipeline)

The tool keeps its own heavy dependencies so the core pipeline stays zero-dependency:

```bash
pip install -r tools/auto-segment/requirements.txt
```

faster-whisper pulls in CTranslate2 (CPU int8 inference, no GPU needed). First run
downloads the model (~500 MB for the default `small`).

## Usage

```bash
py tools/auto-segment/auto_segment.py path/to/project [options]
```

| Flag | Default | Meaning |
|---|---|---|
| `--model` | `small` | faster-whisper model size — `tiny` is faster/looser, `medium` is slower/tighter |
| `--lang` | auto | spoken language code (e.g. `th`); auto-detect when omitted |
| `--pad` | 0.08 | seconds of padding around each cut — the mixer's silence trimming handles the rest |
| `--group-max` | 25 | max seconds per narrator bundle |
| `--write` | off | write directly to `story/segments.json` instead of the `.auto.json` draft |
| `--force` | off | allow overwriting an existing target file |
| `--dry-run` | off | align + report only, no slicing/writing |

## Recording guidance (what makes alignment succeed)

- **Read exactly your own lines, in dialogue order** — extra chatter confuses nothing
  structurally (alignment scans forward) but wastes time and can steal matches
- Natural pace, clear consonants — you control tempo later centrally, never in the recording
- Keep pauses between lines small but audible (~0.3–0.5 s helps separation)
- One file per speaker, named exactly `<spk>.wav` where `<spk>` is the single character
  from dialogue.txt (`M.wav`, `J.wav`). Any ffmpeg-readable format works

## After running

1. Read the confidence report — unmatched (`✗`) and low-confidence (`⚠`) lines are listed
2. Review `story/segments.auto.json`; fix or complete rows for problem lines by hand
3. Move it to `story/segments.json` (or re-run with `--write` once satisfied)
4. `npm run mix` → open `preview.html` → scrub the flagged lines and nudge boundaries
   (editing segment ranges is normal, expected work — not a failure of the process)
