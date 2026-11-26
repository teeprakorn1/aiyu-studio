# Guide: dialogue, voices, and timing

## 1. story/dialogue.txt — the script

```
index|spk|text
```

- `index` runs 0..N-1 contiguously, no gaps (validated with an explicit error)
- `spk` is a single character: `M` = narrator, anything else = a character — **must match `mouthFor('X', o)` in style.js** or mouths won't move
- Keep lines short and speakable — subtitles re-wrap automatically by width; no manual line breaks needed

Example (Thai content, since this pipeline targets Thai-language videos):

```
0|M|ชายที่ทรงพลังที่สุดในวงการชิป ออกจากตำแหน่งเพียง 11 วัน
14|M|แล้วเขาก็พิมพ์อีเมลฉบับนั้น
15|J|ผมตัดสินใจลาออก มีผลทันที
```

## 2. story/segments.json — mapping voice files to lines

```json
{
  "settings": { "tempo": 1.15, "gap": 0.15, "trimThresh": 500, "lineGap": 0.06 },
  "segments": [
    ["n000-004.wav", 0, 4],
    ["c015_J.wav", 15, 15]
  ]
}
```

- Each segment is `[file directly inside vo/, first line, last line]`; paths and `..` traversal are rejected — **must cover 0..N-1 in order with no overlaps or gaps** (validated with an explicit error)
- Narration can bundle several lines per file (saves generation time) — the system distributes time within a file by **character weight** of each line
- **Character lines should be one file per line** — they're short and need precise timing

### File naming convention (from real production)

| Pattern | Used for |
|---|---|
| `n<from>-<to>.wav` e.g. `n000-004.wav` | Narrator |
| `c<line>_<spk>.wav` e.g. `c015_J.wav` | Characters — embedding spk in the name prevents file mix-ups |

## 3. Generating voices (TTS)

- Any format ffmpeg can read — the system converts to mono 24 kHz itself
- Generate one segment at a time per segments.json — **voice must stay consistent across all files** (same voice/prompt)
- Don't speed up inside the TTS — generate at natural pace and speed up centrally with `tempo` so everything rescales together
- **Character voices imitating real people must be disclosed as synthetic** in both the footnote and the caption — see [qc-publish.md](../delivery/01-qc-publish.md)

## 4. tempo — one knob for the whole film's pace

`tempo` in settings uses ffmpeg `atempo` — faster but pitch-preserving. Everything (subs/scenes/mouths) rescales because everything reads talk.js.

Real numbers from production (107-line script, ~10 min at natural pace):

| tempo | Final length | Feel |
|---|---|---|
| 1.0 | 10:01 | Slow, TV-documentary-like — user feedback: "narration drags, story crawls" |
| **1.15** | **8:30** | **Right — this is what shipped** |
| 1.25 | 7:50 | Too fast, hard to follow (especially Thai audiences unfamiliar with the topic) |

Guideline: start at 1.15, listen on a phone, adjust ±0.05 per iteration. Each iteration costs ~15 minutes (re-mix + re-render + re-mux).

`gap` (silence between segments) at 0.15 s and `trimThresh` for edge-silence trimming are battle-tested defaults — don't tune them without reason.

## 5. Two-mode workflow

```bash
npm run stub   # no audio yet: estimated talk.js (~12.5 chars/sec) — lets you build scenes first
npm run mix    # audio complete: real timing + narration.wav + 30-point envelope per line for mouths
```

Recommended: write dialogue → stub → finish scenes → generate voices → real mix → adjust scenes to real timing. Saves TTS regeneration rounds.

## 6. After mixing

- The log prints `dur` — compare against your length target
- Open talk.js and inspect the first few lines: `t0` must increase monotonically with no overlaps; `env` must not be all zeros in real mode (all zeros = silent/broken audio file)
- **Open `preview.html`** — real mode embeds the true narration waveform (`wave`/`waveDur` in talk.js), so the scrubber timeline now shows actual speech peaks instead of the synthesized stub blocks. Scrub line by line and check that mouth movement matches the voice before rendering anything

## 7. Music bed — the second mux input

`mux.mjs` mixes the narration with a looped music bed (`bed.wav` in the project folder by default, +3 dB before mixing). The bed is a **required** input — the template does not ship one, so create or copy it before muxing.

- Keep it quiet: the target is 20–24 dB below speech (measured in the mux verification — see [qc-publish.md](../delivery/01-qc-publish.md))
- The narration is never truncated: mux refuses to run if the narration is longer than the rendered video, so render the full timeline (`npm run publish` reads and ceils talk.js `dur` automatically)
- Voice limiting: narration peaks are limited before mixing (`--voice-limit`, default 0.35) because raw TTS peaks sit above 0 dBTP
