# 🎬 aiyu-studio

**[English](README.md) | [ไทย](README.th.md)**

**Video-as-code for vertical documentaries.** Write scenes in JavaScript, narrate with TTS, and render publish-ready 1080×1920 videos for Reels & TikTok — no video editor, no timeline scrubbing, no manual subtitle sync.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.4.0-blue.svg?style=for-the-badge)](CHANGELOG.md)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=for-the-badge)](#requirements)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](#contributing)

<table>
  <tr>
    <td><img src="docs/images/demo-cold-open.jpg" width="250" alt="Cold open scene"></td>
    <td><img src="docs/images/demo-dialogue.jpg" width="250" alt="Two-character dialogue scene with chart card"></td>
    <td><img src="docs/images/demo-closing.jpg" width="250" alt="Closing scene"></td>
  </tr>
  <tr>
    <td align="center"><sub>Cold open</sub></td>
    <td align="center"><sub>Dialogue + data card</sub></td>
    <td align="center"><sub>Closing</sub></td>
  </tr>
</table>

<sub>Every frame above is pure canvas code rendered by this template's own demo project — characters, subtitles, chart cards and all.</sub>

**▶ [Watch: ทำไมเจนเซนหวงถึงหายไป 11 วัน? — a real production made with this pipeline](https://youtu.be/dNbr5_IbYVY)** — a full Thai-language vertical documentary (the `jensen-legend` project in [examples/legacy/](examples/legacy/jensen-legend/)), demonstrating automatic Thai line-breaking subtitles, speaker-aware lip sync and the final loudness-normalized output in the wild.

## 💡 Why this exists

Vertical documentaries are repetitive to produce: sync subtitles by hand, resize for safe zones, normalize loudness, re-render everything when one line changes. This template treats a video as a **build artifact**: the script is text, the scenes are code, the timing backbone is generated — so changing one line of dialogue re-times the entire film automatically. Battle-tested through seven published iterations of a real production before extraction.

## ✨ Features

- **Single timing backbone** — `talk.js` is generated from your audio and drives scenes, subtitles and lip sync. Nothing is hand-synced, ever
- **Live preview scrubber** — open `preview.html` in a browser (no server needed) and scrub the whole film in real time through the exact production render path: waveform timeline, per-line/scene markers, keyboard transport, A-B loop and scene jump. Catch layout problems before burning a single render
- **Speaker-aware lip sync** — each character's mouth follows only their own lines, with a 30-point energy envelope per line
- **Automatic Thai line-breaking** — subtitles wrap correctly for Thai (and English, and mixed text) via `Intl.Segmenter`; punctuation never orphans onto its own line
- **Spring-motion cards** — cards and pop-ins animate with exact damped-spring physics; every curve is a deterministic pure function, safe for parallel rendering
- **Safe-zone discipline** — built-in margins keep text clear of Reels/TikTok UI overlays; QC live in the preview, then with stills before committing to a full render
- **Parallel chunked rendering** — multiple headless browser processes render disjoint timeline segments simultaneously
- **Broadcast loudness** — two-pass loudnorm to −15.5 LUFS with true-peak limiting, verified by ffprobe after muxing; optional `--bed-duck` sidechain compression ducks the music bed under speech and lets it rise in pauses
- **Cinematic feature modules** — optional `features/atmosphere.js` (multi-stop skies, atmospheric depth, living water, weather, film grain) and `features/people.js` (realistic walk-cycle humans), extracted from the `thai-origins` production in [examples/legacy/](examples/legacy/thai-origins/)
- **Chrome or Chromium** — automatic browser fallback chain; no Chrome license required
- **Tested** — unit + end-to-end pyramid with zero added dependencies; determinism enforced by hash, not by hope
- **One-command scaffolding** — `new-project.py` gives you a working, renderable demo project in seconds
- **Agent skills in every project** — condensed operational rules (`aiyu-authoring` / `aiyu-pipeline` / `aiyu-cinematic`) are scaffolded into `skills/`, so a coding agent writes correct scene code from the first prompt instead of learning the laws by trial and error
- **Optional auto-segmentation** — `tools/auto-segment` drafts `segments.json` and sliced voice files from one long recording per speaker via whisper word-alignment; the manual voice-file workflow stays fully first-class
- **One-command TTS generation** — `tools/tts-gen` synthesizes the whole dialogue into per-line voice files with an exact segments mapping (no alignment anywhere); edge-tts is free and keyless with verified Thai voices, ElevenLabs/Gemini plug in behind the same provider interface
- **Karaoke subtitles** — word-level timing rides along with TTS synthesis (or `story/wordtimes.json` by hand); flip `SUB_KARAOKE` and spoken words highlight left-to-right as the film plays

## 🏗️ How it works

![Pipeline diagram](docs/images/pipeline-diagram.jpg)

<details>
<summary>🔍 <strong>View ASCII pipeline diagram</strong></summary>

```
  python new-project.py my-story ............ scaffold once per story
          |
          v
  [1] INPUTS .................................. you write this
          story/dialogue.txt ... script, one cue per line, with speaker ids
          story/segments.json .. voice file -> line range groups + global tempo
          story/style.js ....... scenes as canvas code over core/ + features/
          vo/*.wav + bed.wav ... voice takes + music bed, at project root
          |
          v
  [2] TIMING BACKBONE ...................... npm run stub / npm run mix
          talk.js ............ single source of truth: timing + mouth envelopes
          narration.wav ...... all voice files joined with gaps
          |
          v
  [3] LAYOUT QC ............ preview.html (live scrub) + npm run stills
          stills/sheet.jpg ... verify layout BEFORE burning render time
          |
          v
  [4] PARALLEL RENDER ...................... npm run publish -- --chunks=N
          out/v1_*.mp4 ....... N headless browsers, disjoint timeline chunks
          |
          v
  [5] MUX + VERIFY ......................... npm run mux
          concat chunks + 2-pass loudnorm -> -15.5 LUFS, ffprobe verified
          |
          v
      final-v1.mp4  (1080x1920, faststart)  =>  Reels / TikTok / YouTube
```

</details>

`new-project.py` scaffolds stage 1; everything downstream derives from `talk.js`.

## 🚀 Quick start

```bash
python new-project.py path/to/my-story   # scaffold a new project
cd path/to/my-story
npm ci                                   # playwright-core (locked)
npm run stub                             # estimated timing — no audio needed yet
npm run stills -- 1,5,10                 # then open stills/sheet.jpg
```

> **Python command:** use `py` on Windows, `python3` on macOS/Linux if `python` is not found.

If the sheet shows characters and subtitles, the pipeline works — or open `preview.html` and scrub the demo live. Continue with the **[quickstart guide](docs/getting-started/01-quickstart.md)** to produce your first full video.

## 📋 Requirements

- **Node.js 20+** · **Python 3** · **ffmpeg** + **ffprobe** on PATH
- **Chrome or Chromium** — the engine tries installed Chrome first, then playwright's headless shell, then the full chromium build (`npx playwright-core install chromium`); override anytime with env `CHROME_PATH` or `--browser=path`
- `playwright-core` — installed with `npm ci` in each project folder

## 📚 Documentation

| Document | Contents |
|---|---|
| [docs/README.md](docs/README.md) | Documentation hub + reading order |
| [docs/getting-started/01-quickstart.md](docs/getting-started/01-quickstart.md) | Zero to first video, step by step |
| [docs/authoring/01-scenes.md](docs/authoring/01-scenes.md) | Scene writing, the runtime API, safe zones, the cam() zoom trap |
| [docs/authoring/02-dialogue-audio.md](docs/authoring/02-dialogue-audio.md) | Dialogue format, segments.json, TTS voices, tempo table |
| [docs/authoring/03-cinematic.md](docs/authoring/03-cinematic.md) | Realistic humans, layered backgrounds, water systems, frame treatments |
| [docs/authoring/04-maps.md](docs/authoring/04-maps.md) | Animated data-driven maps: projection, flow paths, hachure mountains, city markers |
| [docs/authoring/05-parameterized.md](docs/authoring/05-parameterized.md) | Parameterized rendering — many visual variants from one project |
| [docs/delivery/01-qc-publish.md](docs/delivery/01-qc-publish.md) | 7-point QC, Reels/TikTok specs, AI-content disclosure |
| [docs/testing/README.md](docs/testing/README.md) | The test pyramid — strategy, unit, e2e, CI |
| [docs/examples/README.md](docs/examples/README.md) | Production archaeology + notes for both real films |
| [examples/legacy/jensen-legend/](examples/legacy/jensen-legend/) | Complete reference implementation (code only) |
| [examples/legacy/thai-origins/](examples/legacy/thai-origins/) | Cinematic reference: animated map, realistic humans, atmosphere (code only) |
| [CODEBASE.md](CODEBASE.md) | Five-minute map of this repository |
| [AGENTS.md](AGENTS.md) | The five development laws — read before contributing |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

## 🧭 Core principles

1. **Everything derives from `talk.js`** — never hand-edit it; always re-run the mix (`npm run mix` / `npm run stub`)
2. **Scrub in `preview.html` first, verify with stills before every real render** — cam() zoom shifts on-screen positions
3. **Never overwrite older video versions** — always increment v1/v2/v3
4. **Never commit media** — vo/*.wav, out/, *.mp4 are covered by .gitignore

## 📁 Repository structure

```
├── new-project.py            # one-command project scaffolding
├── engine/                   # pipeline scripts (thin shells) + lib/ (all shared logic)
├── template/                 # the project skeleton users receive
│   ├── core/                 #   runtime kernel — primitives, registry, motion, camera (never edit)
│   ├── features/             #   character/subtitles/environment/cards/atmosphere/people (never edit)
│   ├── story/                #   author inputs: style.js, dialogue.txt, segments.json, srchips.js
│   ├── preview.html          #   live scrubber — no server needed
│   ├── skills/               #   agent skills: aiyu-authoring / aiyu-pipeline / aiyu-cinematic
│   └── assets/fonts/         #   Kanit 4 weights (SIL OFL)
├── tests/                    # unit + e2e pyramid (not scaffolded into projects)
├── tools/auto-segment/       # optional whisper-based segments.json drafter (own deps, not scaffolded)
├── docs/                     # documentation system — topical folders, numbered files
├── examples/
│   ├── active/               # future productions on the current architecture
│   └── legacy/               # real productions frozen at their era (jensen-legend, thai-origins)
```

## 🗺️ Roadmap

- [ ] More card types and transitions in the runtime
- [ ] Landscape (16:9) output profile
- [x] ~~One-command TTS generation integration~~ — shipped as `tools/tts-gen`
- [ ] CI-based video rendering example

Ideas and feedback welcome — open an issue.

## 🤝 Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, guidelines and our [Code of Conduct](CODE_OF_CONDUCT.md). Especially valuable: new card/scene patterns for the runtime, TTS provider integrations, and documentation improvements. Please open an issue first for anything beyond a small fix so we can agree on direction. Note that `engine/` and `template/core/` + `template/features/` are intentionally conservative — changes there affect every project built on this template, and the verification gate in [AGENTS.md](AGENTS.md) applies.

## 🙏 Acknowledgements

This pipeline stands on ideas studied from open-source work — most directly **[Yiyu5331/chibi-history-explainer](https://github.com/Yiyu5331/chibi-history-explainer)** (the "video-as-code" philosophy and project-per-story workflow) and **[motion-canvas](https://github.com/motion-canvas/motion-canvas)** (the master-clock player and spring physics — adopted as closed-form pure functions, deliberately diverging from its stateful simulation for the sake of deterministic parallel rendering). No code was copied from any of them; what travelled was ideas, plus hard-won negative knowledge — approaches examined and rejected.

The full provenance — what was adopted, what was rejected and why — lives in **[docs/acknowledgements.md](docs/acknowledgements.md)**.

The pipeline was then hardened through real production (`jensen-legend` v3–v7): tempo scaling, safe-zone discipline for Reels/TikTok, parallel chunk rendering, and loudness-standardized muxing are lessons paid for with actual iterations.

## 📄 License

[MIT](LICENSE) — except the bundled Kanit fonts in `template/assets/fonts/`, which are licensed under the [SIL Open Font License 1.1](template/assets/fonts/OFL.txt) by Cadson Demak.
