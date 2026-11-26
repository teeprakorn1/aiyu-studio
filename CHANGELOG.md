# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2026-11-26

Bugfix and hardening release — no intentional visual output changes; determinism and golden stills remain green.

### Added

- Runtime registry in `core/registry.js` (`defineCharacters()`, `defineScenes()`, `definePeople()`, `defineSourceChips()`, `setFootnote()`) — explicit story configuration replacing hidden globals; legacy `CH`/`SC`/`PCH` globals still work as a compatibility fallback
- Committed root and template `package-lock.json` — scaffolded projects install with `npm ci`; CI uses the locked Playwright version
- `engine/run-py.mjs` cross-platform Python launcher, `engine/lib/encoding.mjs` x264 validation, `engine/lib/talk.mjs` safe talk parsing, `engine/lib/mix_audio.py` importable audio helpers

### Changed

- Runtime files are IIFE-wrapped with explicit `globalThis` exports — no more cross-script lexical redeclaration crashes, still classic-script `file://` compatible
- `publish.mjs` reads duration from `talk.js` automatically (ceiled); `--duration` is now just an override
- e2e tests exercise the real npm-script interface; golden comparison uses pixel drift instead of JPEG byte size

### Fixed

- `publish` referenced nonexistent `meta.totalSec`, rounded duration down (truncating the ending), silently dropped `--crf`, and accepted invalid chunk counts/unknown flags
- `render` lacked `--help` and input validation, ignored ffmpeg exit codes, and could report success on missing/empty output
- `mix-studio.py` used asserts and silent failures for malformed dialogue, bad segment coverage, invalid settings, and voice path traversal; generated `talk.js` could break out of its script tag on `</script>` in dialogue
- `mux` accepted invalid loudness/encoding values and inverted verification regions; ffmpeg stderr capture was uncapped
- `preview.html` injected dialogue via `innerHTML`; character/personTH resolution was coupled through hidden globals


## [0.3.0] - 2026-11-26

Architecture release — engine and template restructured into testable layers, plus live preview, spring motion, Chromium support, and a full test pyramid. **Breaking for scaffolded projects** — see Upgrading.

### Added

- `preview.html` — live scrubber in the browser (`file://`, no server): waveform timeline, per-line/scene markers, click-drag seeking, speed control, keyboard transport. Real mode uses true narration peaks (`wave`/`waveDur` now embedded in `talk.js` by `mix-studio.py`); stub mode synthesizes the waveform from line envelopes
- Motion curves `easeInOut` / `easeBack` / `easeElastic` / `springy` — deterministic pure functions, safe for parallel chunk rendering
- Full test pyramid — `node:test` units (`engine/lib`, motion curves, python audio math), e2e (pipeline smoke, determinism sha256, golden stills, preview transport), GitHub Actions workflow — separate fast unit / slow e2e jobs, npm scripts as single source of truth, version-keyed chromium cache, per-ref concurrency. Zero new dependencies
- npm scripts in scaffolded projects — `mix` / `stub` / `stills` / `render` / `publish` / `mux` / `check-subs`
- `AGENTS.md` — development rules: dependency direction, the five laws, mandatory JSDoc, naming rules

### Changed

- **Breaking — engine layout:** scripts live in `engine/` inside projects and resolve from the project root; renamed `publish-v4.mjs` → `publish.mjs`, `mux-v4.mjs` → `mux.mjs`, `mix_studio.py` → `mix-studio.py`; shared logic extracted into `engine/lib/` (`cli-args` / `playwright-env` / `ffmpeg` / `loudness` / `mp4-verify` / `chunking`)
- **Breaking — template runtime:** monolithic `rig.js` split into 3 layers `core/` ← `features/` ← `story/`; author inputs moved to `story/` (`mix-studio.py` reads `story/dialogue.txt` + `story/segments.json` by default); hidden `people.js` → `atmosphere` dependency removed (shared color/random primitives now in `core/base.js`)
- **Docs restructured** into topical folders with numbered files and per-folder indexes — `getting-started/` `authoring/` `delivery/` `examples/` `testing/`; all guides now teach the npm-script interface and the preview-first safe-zone workflow, and the pyramid is documented end to end (strategy → unit → e2e → CI)
- **Examples reorganized** into `examples/active/` (future productions on the current architecture) and `examples/legacy/` — v0.1.0/v0.2.0 snapshots kept byte-identical as historical documents with era banners — documented in versioned folders under `docs/examples/` including full production notes for both films; do not copy their file organization
- Chrome-only → Chrome **or Chromium** — automatic fallback chain (installed Chrome → playwright headless shell → full chromium); override with env `CHROME_PATH` or `--browser=path`, forwarded to every parallel chunk
- Cards and `pop()` now scale with `springy` — physical ~20% overshoot settle out of the box; all other visuals unchanged

### Fixed

- `new-project.py` crashed when `engine/` contained a directory (`__pycache__`)
- `regionSpec` rejected whitespace-padded time regions
- Stub-mode preview showed an empty waveform — lines now render as presence blocks
- `publish.mjs` default `--out` prefix was the fossil `v4` — now `v1`

### Upgrading from 0.2.0

- Copy `engine/` (whole tree), `template/core/`, `template/features/`, `template/preview.html` into existing projects; move `dialogue.txt`/`segments.json`/`style.js`/`srchips.js` into `story/`; replace `index.html`; delete the old flat engine scripts, `rig.js`, `atmos.js`, `people.js`
- `style.js` content needs no changes — every function keeps its global name
- Re-run `mix-studio.py` in real mode to embed the waveform; re-check stills (card entrances now bounce)

## [0.2.0] - 2026-11-26

Cinematic upgrade — techniques proven in the `thai-origins` production, extracted into two optional template modules.

### Added

- `template/atmos.js` — cinematic atmosphere library: multi-stop skies, haze, hills/trees/clouds/birds, living water, smoke, motes, film grain, vignette, caption scrim. Deterministic and chunk-parallel-safe
- `template/people.js` — `personTH()` realistic human renderer: ~5.5-head proportions, jointed limbs, correct alternating walk cycle, config-driven characters. An alternative to rig's mascot `person()`
- `examples/thai-origins/` — complete production code: animated parchment map, dusk city scenes, bespoke thumbnail painter
- `docs/guide-cinematic.md` + `docs/guide-map.md` — deep dives into the techniques above
- `rv(o, n)` — line-scoped reveal helper in rig.js (exported via `window`, like the modules)
- `mux-v4.mjs --verify-tp` — verify true peak against the −2.0 dBTP delivery ceiling instead of the loudnorm target, which AAC always overshoots

### Changed

- `template/index.html` loads `atmos.js` and `people.js` (optional)
- `rig.js` `person()` API is unchanged; its walk animation is fixed (see Fixed)
- `mux-v4.mjs` writes `final.mp4` in the project folder by default (was `../video/output.mp4`)
- `mux-v4.mjs` bed-vs-speech check runs only when `--pause` and `--speech` are passed

### Fixed

- `rig.js` `person()`: legs swung in unison instead of alternating
- `rig.js` `shot()`: mouth envelope no longer holds its last value during gaps between lines
- `render.mjs`: the `pageerror` listener is attached before page load, so script errors are reported; the default output name was a non-English placeholder left over from the source production, now `video`
- `mux-v4.mjs`: removed production-specific default verification timestamps
- `measure-subs.mjs`: overflow threshold now matches the rig's 840px frame limit
- Template demo: quote card no longer re-animates on every following line

### Upgrading from 0.1.0

- Copy `engine/*` and `template/rig.js` into existing projects to get the walk, mouth and render fixes
- Existing `style.js` files need no changes; `rv()` and the cinematic modules are optional

## [0.1.0] - 2026-11-25

First public release — extracted from the real production of `jensen-legend` (v3–v7), verified end-to-end.

### Added

- Five reusable engine scripts: `render.mjs`, `publish-v4.mjs` (parallel chunks), `mux-v4.mjs` (2-pass loudnorm −15.5 LUFS + ffprobe verify), `mix_studio.py` (generic, reads `dialogue.txt` + `segments.json`, stub mode), `measure-subs.mjs`
- Single timing backbone: everything derives from generated `talk.js` — subtitles, scenes, mouth envelopes
- `rig.js` with full JSDoc: characters, cam() camera, Thai/English auto line-breaking subtitles, source chips, card props
- Speaker-aware lip sync — mouths follow only the character's own lines
- `new-project.py` one-command scaffolding (includes ready `.gitignore` in generated projects)
- `template/` skeleton with a 3-scene demo that renders out of the box + Kanit fonts with full `OFL.txt`
- Bilingual docs: English + Thai READMEs, guides in `docs/`, real demo frames, pipeline diagram, linked production video
- Community files: MIT LICENSE, CONTRIBUTING.md, Contributor Covenant 2.1
- `examples/jensen-legend/` reference implementation (code only)


[Unreleased]: https://github.com/teeprakorn1/aiyu-studio/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/teeprakorn1/aiyu-studio/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/teeprakorn1/aiyu-studio/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/teeprakorn1/aiyu-studio/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/teeprakorn1/aiyu-studio/releases/tag/v0.1.0
