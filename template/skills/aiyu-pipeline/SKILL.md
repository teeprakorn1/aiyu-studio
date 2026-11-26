---
name: aiyu-pipeline
description: Run the aiyu-studio production pipeline — dialogue.txt, segments.json, stub/mix timing backbone, QC gates, parallel publish, loudness-verified mux, versioning rules, troubleshooting. Use when mixing audio, rendering, publishing, muxing, or diagnosing pipeline failures.
---

# aiyu-pipeline — taking a story from script to published video

## When this skill applies

| Trigger | Action |
|---|---|
| Running any mix/render/publish/mux command | Use npm scripts — never raw engine invocations |
| Timing looks wrong anywhere | 🛑 STOP — never patch talk.js; fix inputs, re-run the mix |
| About to publish a full render | Run the pre-publish gate below first — every checkbox |
| Anything failed with an error | Read the troubleshooting table before retrying blindly |

## 🛑 Pre-publish gate (mandatory before every real render)

| Gate | Passed? |
|---|---|
| preview.html scrubbed — lip sync + layout verified line by line | |
| `npm run stills` sheet checked with eyes — safe zones, card widths | |
| `npm run check-subs` green | |
| `npm run mix` re-run after the LAST dialogue/voice edit — talk.js is current | |
| `--out` is a NEW version/variant name — nothing overwritten | |

> 🔴 Publishing without the gate = burning 15–30 minutes of render to learn what preview.html shows in 10 seconds.

## The pipeline and its gates

```
story/dialogue.txt + story/segments.json + vo/*.wav
  → npm run stub / npm run mix     talk.js + narration.wav  (the only timing truth)
  → preview.html + npm run stills  layout QC — BEFORE any render
  → npm run publish -- --chunks=N  parallel render → out/v1_*.mp4
  → npm run mux                    loudness-normalized final-v1.mp4 (ffprobe-verified)
```

**Always use npm scripts — never raw `node engine/...` or `python engine/...` invocations.** The scripts are the stable interface; they pin working directory and flag passing.

## Inputs you author

### story/dialogue.txt

```
0|M|ชายที่ทรงพลังที่สุดในวงการชิป ออกจากตำแหน่งเพียง 11 วัน
15|J|ผมตัดสินใจลาออก มีผลทันที
```

`index|spk|text` — index runs 0..N-1 contiguous, `spk` is one character and **must match `mouthFor('X', o)`** in style.js. Keep lines short; subtitles re-wrap automatically (Thai line-breaking is built in).

### story/segments.json

```json
{
  "settings": { "tempo": 1.15, "gap": 0.15, "trimThresh": 500, "lineGap": 0.06 },
  "segments": [["n000-004.wav", 0, 4], ["c015_J.wav", 15, 15]]
}
```

- `[file in vo/, first line, last line]` — must cover 0..N-1 in order, no gaps/overlaps (validated with explicit errors)
- Narrator can bundle several lines per file; **character lines are one file per line** (short, need precision)
- Naming convention: `n<from>-<to>.wav` narrator, `c<line>_<spk>.wav` characters

## Two-mode timing workflow

1. `npm run stub` — **before audio exists**: estimated timing (~12.5 chars/sec). Build and polish all scenes against this.
2. `npm run mix` — **after voices are in vo/**: real timing, joins narration.wav, computes the 30-point mouth envelope per line, embeds the true waveform in talk.js for the preview scrubber.

Recommended order: write dialogue → stub → finish scenes → generate voices → real mix → adjust scenes to real timing. Never hand-edit talk.js — re-run the mix.

## tempo — one knob for the film's pace

`tempo` in settings uses ffmpeg atempo (pitch-preserving speedup); everything rescales because everything reads talk.js. Battle-tested: **1.15 is the sweet spot** for Thai documentary narration (1.0 drags, 1.25 is too fast). Adjust ±0.05 per iteration. Don't touch `gap`/`trimThresh` defaults without reason.

## QC gates — never skip

1. **preview.html** — scrub live, check lip sync per line, catch layout problems
2. `npm run stills -- 1,5,10` then open `stills/sheet.jpg` — verify layout/safe zones statically
3. `npm run check-subs` — subtitle width/overflow verification
4. After mux: check the verification output — loudness ≈ −15.5 LUFS, true peak within limit, bed sits 20–24 dB below speech

## Versioning rules (sacred)

- **Never overwrite older versions** — `--out` is `v1` by default; increment: `--out=v2`, `--out=v3` (publish chunks → `out/v2_*.mp4`, mux `--out=final-v2.mp4`)
- **Never commit media** — `vo/*.wav`, `out/`, `*.mp4` are gitignored
- `bed.wav` (music bed) is a **required** mux input — create/copy it into the project root before muxing; keep it quiet

| ❌ WRONG | ✅ CORRECT |
|---|---|
| re-render over `out/v1_*` "because it's just a small fix" | `--out=v2` — storage is cheap, lost work is not |
| patch talk.js `dur` so publish covers the end | re-run `npm run mix` — the input changed, not the truth |
| retry the same failing command 3 times | read the error — validation messages say exactly what is wrong |

## Troubleshooting — seen in production

| Symptom | Cause | Fix |
|---|---|---|
| Mouths never move | spk in dialogue.txt ≠ `mouthFor('X', o)` argument | align the single-character ids |
| `env` all zeros in talk.js (real mode) | silent/corrupt voice file | regenerate that vo file, re-mix |
| Validation error: coverage/overlap in segments.json | line ranges don't tile 0..N-1 exactly | fix the ranges — every line exactly once |
| mux refuses: narration longer than video | publish didn't cover full timeline | re-publish (duration auto-derives from talk.js — check talk.js dur is current) |
| Everything suddenly re-times wrong | someone hand-edited talk.js | re-run `npm run mix` — never patch talk.js |
| Chunks differ at seams | non-deterministic code in story/ (Math.random/Date.now) | use `srnd(seed)` — this breaks the determinism law |
| No waveform in preview | only ran stub | normal — real waveform appears after `npm run mix` |
| Publish stalls/hangs | stuck headless browser or bad flags | check error output; unknown flags are rejected loudly — read the message |

## Rendering flags cheatsheet

- `npm run publish -- --chunks=4` — parallel chunk count (default usually fine; more chunks = more browser processes)
- `--crf` / `--preset` — encoding quality/speed, validated and forwarded to every chunk
- `npm run render -- --range=0:10` — single-range test render (see `--help`)
- `npm run mux -- --verify-tp` — documented in mux `--help`
