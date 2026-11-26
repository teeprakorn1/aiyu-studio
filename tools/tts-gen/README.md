# tools/tts-gen — synthesize dialogue into vo/*.wav + segments.json (optional)

**This tool is optional.** Recording your own voice or generating voice files by any
other means — and writing `story/segments.json` by hand — remains a first-class,
fully supported workflow. tts-gen is for the other workflow: you want synthetic
voices and zero manual audio bookkeeping.

## What it does

```
story/tts.json   (speaker -> provider+voice map you write once per production)
      │
      ▼  py tools/tts-gen/tts_gen.py path/to/project --write
vo/n000-000.wav, vo/c003_H.wav, …   ONE FILE PER LINE, per the naming convention
story/segments.auto.json            DRAFT mapping — exact by construction, no alignment
story/wordtimes.auto.json           DRAFT word timing — enables karaoke subtitles
```

Why one file per line is the right shape: `segments.json` maps files to line ranges,
so per-line files make the mapping exact without any alignment step. (Grouped files
force the mixer to split audio across lines proportionally by character count — an
approximation this tool simply never needs.)

## Setup

```
pip install -r tools/tts-gen/requirements.txt
```

Keeps its own dependencies, like every optional tool — the core pipeline never requires it.

## Configuration — `story/tts.json` in your project

```json
{
  "defaults":  { "provider": "edge", "voice": "th-TH-NiwatNeural" },
  "speakers": {
    "H": { "voice": "en-US-AriaNeural" },
    "G": { "provider": "elevenlabs", "voice": "<voice-id>" }
  }
}
```

Every dialogue speaker must resolve to a provider+voice (own entry or `defaults`).

## Providers — honest capability tiers

| provider | tier | word timing | status | key |
|---|---|---|---|---|
| `edge` | A | yes — when the voice supports it | **verified against the live service** | none — free |
| `elevenlabs` | A | yes, from character alignment | **EXPERIMENTAL — implemented per API spec, untested live** | `ELEVENLABS_API_KEY` |
| `gemini` | B | **no** — karaoke unavailable | **EXPERIMENTAL — implemented per API spec, untested live** | `GEMINI_API_KEY` |

### The edge-tts word-timing quirk (verified live, matters for karaoke)

Word boundaries are **voice-specific, not language-specific**: `th-TH-NiwatNeural`
emits precise per-word timing; `th-TH-PremwadeeNeural` refuses the request entirely
(the service returns no audio). This cannot be a config-time decision — the tool
detects it at runtime, falls back to plain audio, and reports which lines came out
untimed. Lines without timing simply lack karaoke; everything else works. If you need
karaoke for a voice that won't emit word timing, record or synthesize first and
backfill with `tools/auto-segment` (whisper) instead.

## Usage

```
py tools/tts-gen/tts_gen.py path/to/project              # dry-run: print the plan
py tools/tts-gen/tts_gen.py path/to/project --write      # synthesize everything
py tools/tts-gen/tts_gen.py path/to/project --write --only 3,4   # re-do specific lines
py tools/tts-gen/tts_gen.py path/to/project --write --force      # overwrite drafts
```

Then review, rename `segments.auto.json` → `segments.json` (and `wordtimes.auto.json`
→ `wordtimes.json` for karaoke), and `npm run mix` as usual. Drafts are never
overwritten without `--force`; a partial failure exits non-zero and reports the lines.

## Notes

- `edge-tts` is an unofficial client of a Microsoft service — pinned in
  requirements.txt; if it breaks, only this tool breaks, never the pipeline.
- `rate` (e.g. `"+10%"`) applies to edge-tts synthesis; the `tempo` setting in
  segments.json remains a separate, additional whole-track control in the mixer.
- Word timing is relative to each line's synthesized audio; the mixer rescales it
  into timeline time. Silence trimming makes it approximate by tens of milliseconds —
  visually irrelevant for karaoke.
