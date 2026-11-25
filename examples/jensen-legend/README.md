# jensen-legend — reference implementation

Complete code from a real production (v7 video: 8:30, 107 lines, 19 scenes) — use it as the pattern when writing your own projects.

**No media files in this folder, by design** — `vo/`, `narration.wav`, `talk.js` must be generated following the main README steps.

Files to read first:
- `style-v4.js` — character rig, cam(), subtitles, chips, footnote, all 19 scenes (note how positions are computed around zoom in docs/pipeline.md §5)
- `dialogue-v5.txt` — real script format with character spk tags
- `segments.json` — real segment mapping: narrator files bundle multiple lines, character files one line each
- `srchips.js` — line-range-based source chip system
