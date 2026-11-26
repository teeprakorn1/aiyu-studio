# Real production pipeline: jensen-legend v3–v7 (historical record)

> ⚠ **Read first:** this is a historical production record — **all principles still apply**, but several mechanics differ from the current template:
>
> | In this document (original production) | Current template |
> |---|---|
> | `SEGMENTS` hardcoded in mix-studio.py | moved to `segments.json` — see [guide-audio.md](../../authoring/02-dialogue-audio.md) |
> | new projects copied the jensen-legend folder | use `python new-project.py` — see [quickstart.md](../../getting-started/01-quickstart.md) |
> | single `style-v4.js` file (rig + scenes mixed) | split into the `core/` + `features/` runtime (never edit) / `style.js` — see [guide-scenes.md](../../authoring/01-scenes.md) |
> | filenames `index-v4.html` / `dialogue-v5.txt` | `index.html` / `dialogue.txt` |
> | mux output in `../video/` | `final.mp4` in the project folder (`--out` to change) |
> | bed-vs-speech check at fixed 40.4–41.4 s | opt-in: `--pause=a-b --speech=c-d` — see [qc-publish.md](../../delivery/01-qc-publish.md) |
> | — | sheet.jpg now displays vertical frames correctly (render.mjs bug fixed) |
>
> Everything about safe zones, the cam() zoom trap, QC, and the audio workflow applies unchanged.

---

## Pipeline as actually run for `jensen-legend` v3–v7 (vertical 1080×1920 for Reels/TikTok)

> Written from real work on 2025-11-25 — the audio/timing architecture was rebuilt wholesale during this production. Use this as the pattern for future projects.

### 1. System data flow

```
dialogue-v5.txt (107 lines: index|spk|text)
        │
        ▼  voices generated file by file in AI Studio (manual)
vo/*.wav — 1–8 lines per file (24kHz mono s16le)
        │
        ▼  mix-studio.py  (TEMPO/trim/gap as the single control point)
talk.js (t0/dur/spk/env 30 points per line) + narration.wav
        │
        ▼  index-v4.html + style-v4.js — everything reads time from TALK only
        │  window.DURATION = TALK.dur (no hardcoded seconds)
        ▼  render.mjs (stills) / publish.mjs (6 parallel chunks)
out/v*_0-N.mp4 × 6
        │
        ▼  mux.mjs — concat + limiter + bed + 2-pass loudnorm + faststart
video/jensen-legend-vN.mp4
```

**The single most important principle:** everything (subtitles, scene boundaries, character mouths, envelopes, video duration) derives from the one `talk.js` — change audio speed or re-mix at any time and the entire film rescales automatically, zero visual code edits.

### 2. Files and their roles (production folder `video-work/project/jensen-legend/`)

| File | Role |
|---|---|
| `dialogue-v5.txt` | 107-line script, format `index\|spk\|text` — spk: M=narrator, J=Jensen, T=Trump |
| `mix-studio.py` | audio assembly: trim edge silence → atempo → measure 30-point env per line → write talk.js + narration.wav — parameters: `TEMPO`, `GAP=0.15`, `TRIM_THRESH` |
| `talk.js` | timing output — **never hand-edit**, always re-run mix |
| `style-v4.js` | all 19 scenes as procedural canvas, subtitles, source chips, footnote, character rig |
| `index-v4.html` | render page: loads talk.js + style, exposes `window.render(t)`/`window.DURATION` |
| `render.mjs` | `stills t1,t2` = stills / `video from,to` = range rendering (via playwright) |
| `publish.mjs` | splits into 6 parallel chunks (16 cores ≈ 6.5 fps/process; an 8–10 min film took 6–9 real minutes) |
| `mux.mjs` | concat → scale pc→tv bt709 → alimiter → amix bed(+3dB) → loudnorm I=−15.5 TP=−1.5 2-pass → faststart + ffprobe verify |
| `srchips.js` | source-chip definitions by line range (layer k=0 at y=300, k=1 at y=354) |
| `tts-aistudio-v5.txt` | manual voice-generation notes — **not a system input** |
| `thumb.html` | vertical/horizontal thumbnails |

### 3. Audio workflow (the heart of the system)

- Voice files are **segments** covering multiple lines each (e.g. `n000-004.wav` = lines 0–4) — `SEGMENTS` in mix-studio.py must cover 0..106 contiguously, enforced by assert
- Time within a segment distributes by character-count weighting — subtitles match speech approximately, not per-word
- Real character voices (J/T) live in separate files `c015_J.wav` etc. so spk tags line up
- Old voice files can be reused when their lines haven't changed — compare byte-for-byte against the older set first
- Retuning the whole film's speed = change `TEMPO` alone and re-mix: 1.25x → 7:50, 1.15x → 8:30, 1.0x → 10:01 (for this script)

### 4. Speaker-aware mouths (an important lesson)

Originally the narrator's envelope fed every character's mouth → characters chewed along while others spoke. Fixed with `mouthFor(spk, o)` — the envelope applies only to lines whose `spk` matches that character; otherwise the mouth stays shut. Tested by evaluating values directly in the browser for every key line.

### 5. Safe zones for Facebook Reels (measured and fixed over many rounds)

| Zone | Values used | Notes |
|---|---|---|
| Subtitles | 350–450 px above bottom edge (used ~420), width ≤840 px (120 px side margins) | user-specified numbers; Meta has no official confirmation — only ad guidelines (bottom 35%) |
| footnote disclaimer | y≈268, small 22px, faint alpha .42 | fine print meant to "be present" more than "be read" |
| scene headings | always below y≈260 | **big trap:** scenes use `cam()` zoom around cy — real position = `cy + (y − cy) × zoom`; must compute for the scene's maximum zoom or headings drift into the top bar mid-scene |
| source chips | y=300/354 | check collisions with headings in every chipped scene (NYT/CNBC/US HOUSE collisions had to be fixed one by one) |

**Verification method actually used:** render stills covering all scenes → draw red line at y=250 and yellow at y=1570 with ffmpeg drawbox → tile into a contact sheet and scan by eye.

### 6. QC checklist (run every round before delivery)

1. `ffprobe`: duration/frames/1080×1920/yuv420p/bt709/tv range/faststart (moov before mdat)
2. post-encode loudness: target −15.5 LUFS, TP ≤ −1.5 (real results −15.5x / −2.0)
3. **bed-below-speech must be measured at real narration pauses** (mask −55dB), not a fixed window — the original mux warning measured 40.4–41.4 s, a jensen-legend-specific window; since v0.2.0 the check is opt-in and needs `--pause`/`--speech` (real value ~24 dB)
4. color: compare a decoded frame with a still at the same time — 1–3 levels/channel off is normal
5. seams at chunk boundaries: diff should ≈ control (adjacent frames within a scene) — **beware false alarms when a scene cut coincides with a boundary** (hit diff 42 exactly at a cut once; continuity was fine)
6. subtitles: measure every line's width within frame + no overlapping lines (gap ≥ −0.001)
7. listen to source voice files: peaks, edge silence — **but AI cannot hear language; a human must always verify TTS speaks the intended language**

### 7. Pits fallen into this production (don't repeat)

- Placing headings by written y-values without accounting for cam() zoom → headings float into the top bar mid-scene
- Subtitles at fixed positions while Facebook UI overlays 2 zones — always test in the real app; never trust any safe-zone number 100%
- Same position doesn't work across scenes — chips/labels fine in one round collide in the next after unrelated moves; re-scan the contact sheet after every layout fix
- Never overwrite old version files — increment v5/v6/v7, because the user may compare pacing backwards

### 8. Starting a new project on this system

1. Write the script as `dialogue-*.txt` in the same format, adding spk for real speaking characters
2. Generate voices in AI Studio segment by segment (voices used: Orus=narrator, Iapetus/Charon=characters) into `vo/`
3. Edit `segments.json` to cover 0..n-1 → run mix → check overlaps/env
4. Write/adjust `style.js` (scenes reusable from this project; the `core/` + `features/` runtime stays untouched) — bind SC to line numbers
5. Render stills of every scene + safe-zone lines → fix collisions before any real render (huge time saver)
6. publish 6 chunks → mux → QC per section 6 → watch once on a real phone before publishing

### 9. Legal/editorial requirements to carry into every project

- "simulated imagery" labels everywhere drawings stand in for real footage
- real-person character voices = synthetic; never clone real voices; require "simulated voice/read from real public statements" labels, include it in the upload caption, and tick the platform's AI-generated flag
- unverified allegations must be written as unverified within the script itself
- private/family matters of real people must pass editorial/legal review before publishing, always
