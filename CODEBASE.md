# CODEBASE.md — map of the aiyu-studio codebase

Orient yourself in five minutes. For binding development rules read [AGENTS.md](AGENTS.md); for documentation read [docs/README.md](docs/README.md).

## What this is

A pipeline for producing vertical (1080×1920) documentary videos from **procedural canvas scenes + TTS narration** — no video footage, no editor. Authors write dialogue and JavaScript scene functions; the engine mixes audio, renders frames headless in parallel, and muxes a loudness-normalized final mp4.

This is a **template repository**: users do not work here, they scaffold independent projects with `new-project.py`. Everything in this repo exists to be copied or to verify what gets copied.

## Directory map

```
aiyu-studio/  (repo: github.com/teeprakorn1/aiyu-studio)
├── new-project.py        scaffolder — copies template/ + engine/ into a new project folder
├── template/             what users receive — the render runtime + author workspace
│   ├── core/             LAYER 1 kernel: canvas primitives, explicit registry, motion curves, camera, composition root
│   ├── features/         LAYER 2 domain: character, subtitles, environment, cards, atmosphere, people
│   ├── story/            LAYER 3 author inputs: style.js, srchips.js, dialogue.txt, segments.json
│   ├── assets/fonts/     bundled Kanit fonts (SIL OFL 1.1)
│   ├── package.json + package-lock.json   npm scripts (the user interface) + locked playwright-core
│   ├── index.html        the render page (production path)
│   ├── preview.html      live scrubber — same scripts, same render(t), no server needed
│   └── skills/           agent skills (aiyu-authoring / aiyu-pipeline / aiyu-cinematic) — condensed rules for coding agents
├── engine/               pipeline machinery — thin executable shells over engine/lib/
│   ├── mix-studio.py     dialogue+voices → talk.js (single timing truth) + narration.wav
│   ├── run-py.mjs        cross-platform Python launcher used by scaffolded npm scripts
│   ├── render.mjs        headless stills / single-range video
│   ├── publish.mjs       parallel chunk rendering
│   ├── mux.mjs           concat + loudness + faststart + self-verification → final.mp4
│   ├── measure-subs.mjs  subtitle overflow acceptance
│   └── lib/              all shared logic (cli-args, playwright-env, ffmpeg, encoding, loudness, mp4-verify, chunking, talk, mix_audio)
├── tests/                the pyramid — unit (node:test + python unittest) + e2e; never scaffolded
├── tools/auto-segment/   optional whisper-based segments.json drafter — own dependencies, never scaffolded
├── docs/                 documentation system — topical folders, numbered files, per-folder indexes
├── examples/
│   ├── active/           future productions on the current architecture (empty until first)
│   └── legacy/           real productions frozen at their era — jensen-legend (v0.1.0), thai-origins (v0.2.0)
└── AGENTS.md · CHANGELOG.md · CONTRIBUTING.md · CODEBASE.md (here) · SECURITY.md
```

## The three planes

1. **Data** — `story/dialogue.txt` + `story/segments.json` → `mix-studio.py` → `talk.js` + `narration.wav`. talk.js is the single timing truth; everything visual derives from it.
2. **Runtime** — browser classic scripts (no ES modules — `file://` forbids them): `core/ ← features/ ← story/`, every visual a pure function of time `t` so parallel chunks join seamlessly.
3. **Execution** — engine scripts drive `index.html` headless via playwright, render chunks in parallel, mux with loudness normalization and self-verification.

## Where to go for what

| I want to… | Start here |
|---|---|
| Use the pipeline to make a video | [docs/getting-started/01-quickstart.md](docs/getting-started/01-quickstart.md) |
| Write scenes | [docs/authoring/01-scenes.md](docs/authoring/01-scenes.md) + [template/README.md](template/README.md) |
| Change engine behavior | `engine/lib/` first — scripts are thin shells; [AGENTS.md](AGENTS.md) law 3 |
| Change how characters/cards look | `template/features/` — never `core/` for domain concerns |
| Add a motion curve or camera behavior | `template/core/motion.js` / `camera.js` — pure functions of `p`/`t` only |
| Fix a failing test | [docs/testing/README.md](docs/testing/README.md) — which layer owns it |
| Understand why a rule exists | [AGENTS.md](AGENTS.md) + the production notes in `docs/examples/` |

## Verification quickref

```bash
npm test            # unit — seconds; run constantly
npm run test:e2e    # full pipeline — minutes; before merging engine/runtime/scaffold changes
```

The verification gate in [AGENTS.md](AGENTS.md) (law 5) defines when a change is done.
