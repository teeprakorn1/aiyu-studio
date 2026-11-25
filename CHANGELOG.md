# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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


[Unreleased]: https://github.com/teeprakorn1/aiyu-studio/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/teeprakorn1/aiyu-studio/releases/tag/v0.1.0
