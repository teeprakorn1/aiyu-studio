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

## Listing voices

```
py tools/tts-gen/tts_gen.py --list-voices          # providers and their status
py tools/tts-gen/tts_gen.py --list-voices edge     # edge-tts voices from the service (needs network)
```

Other providers do not list voices; set their voice names directly in `story/tts.json`.

## Providers — honest capability tiers

| provider | tier | word timing | status | key |
|---|---|---|---|---|
| `edge` | A | yes — when the voice supports it | **verified against the live service** | none — free |
| `elevenlabs` | A | yes, from character alignment | **verified live with one Thai sample** (`eleven_v4`, voice Sarah, 2026-11-27) | `ELEVENLABS_API_KEY` |
| `gemini` | B | **no** — karaoke unavailable | **verified live with one Thai sample** (`gemini-3.8-flash-tts`, voice Kore, 2026-11-27) | `GEMINI_API_KEY` |

Gemini uses the Interactions API (`POST /v1beta/interactions`, model `gemini-3.8-flash-tts`). The key travels in the `x-goog-api-key` header, never in the URL. `gemini-3.8-flash-tts` is the model that lists Thai; `gemini-3.8-flash-lite-tts` does not. The provider reads the last audio block of the response. The free tier may use submitted content to improve Google's products, so use a paid-tier key for real dialogue. The `rate` setting is ignored for Gemini, and there is no retry on rate limits.

ElevenLabs uses the with-timestamps endpoint (`POST /v1/text-to-speech/{voice_id}/with-timestamps`, model `eleven_v4`). The key travels in the `xi-api-key` header, and `output_format` is a query parameter (`mp3_44100_128`). `eleven_multilingual_v2` does not list Thai, so the provider uses `eleven_v4`. Voices are identified by voice ID, not by name. Word timing comes from the returned alignment; in the sample checked, the last word's end ran about 0.2 s past the speech, so karaoke may linger briefly on the final word. The `rate` setting is ignored, and there is no retry on rate limits.

Each provider was checked with one Thai sample. Other voices, languages, and models are untested; treat them as a test.

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
