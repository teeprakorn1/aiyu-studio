# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2025-11-26

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

## [0.1.0] - 2025-11-25

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


[Unreleased]: https://github.com/teeprakorn1/aiyu-studio/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/teeprakorn1/aiyu-studio/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/teeprakorn1/aiyu-studio/releases/tag/v0.1.0
