# jensen-legend — reference implementation

Complete code from a real production (v7 video: 8:30, 107 lines, 19 scenes).

> **Legacy snapshot — v0.1.0-era layout.** The runtime is embedded inside `style-v4.js`
> as one monolith and files carry `-v4`/`-v5` production suffixes (both since banned by
> the naming rules in `AGENTS.md`). Study the scene composition, dialogue format and
> segment mapping — every function call is still valid API — but do **not** copy this
> file organization. New projects use the `template/` 3-layer layout;
> see [docs/examples/README.md](../../../docs/examples/README.md).

**No media files in this folder, by design** — `vo/`, `narration.wav`, `talk.js` must be generated following the main README steps.

Files to read first:
- `style-v4.js` — character rig, cam(), subtitles, chips, footnote, all 19 scenes (note how positions are computed around zoom in docs/examples/v010-jensen-legend/01-jensen-pipeline.md §5)
- `dialogue-v5.txt` — real script format with character spk tags
- `segments.json` — real segment mapping: narrator files bundle multiple lines, character files one line each
- `srchips.js` — line-range-based source chip system
