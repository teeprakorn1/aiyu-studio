# jensen-legend — the first production (v0.1.0 era)

The production the entire template was extracted from: a Thai-language vertical
documentary (8:30, 107 dialogue lines, 19 scenes) about Jensen Huang's childhood —
[watch it here](https://youtu.be/dNbr5_IbYVY). Everything in `engine/` and `template/`
exists because something in this film needed it.

**Production code:** [examples/legacy/jensen-legend/](../../../examples/legacy/jensen-legend/)

## In this folder

| File | Contents |
|---|---|
| [01-jensen-pipeline.md](01-jensen-pipeline.md) | production notes from v3–v7, written during the work — the pipeline as actually run, speaker-aware mouths, the safe-zone measurements, the QC checklist, and the archaeology table mapping each original hack to its current mechanism |

## What this production demonstrates

- **Automatic Thai line-breaking subtitles** — no language in the world wraps like English; the grapheme-segmented layout was built for this script
- **Speaker-aware lip sync** — narrator + two character voices (J/T), mouths only move for their own lines
- **19 scenes at real scale** — positions computed around cam() zoom, special-purpose props (paperSheet, wallClock, routeCurve, cargoShip, serverRack, gpuChip, …) copyable into your own `style.js`
- **The full audio architecture** — segment-based voice files, `tempo` as the single speed knob, everything deriving from `talk.js`

## What to study in the code itself

- `style-v4.js` — 19 real scenes; the rig of its era is embedded in it (monolith)
- `segments.json` — real mapping: narrator files bundle multiple lines, character files one line each
- `dialogue-v5.txt` — real script format with character spk tags

The layout is a **v0.1.0 fossil** (monolith rig inside the style file, versioned
filenames) — read the code, never copy the organization. See
[../README.md](../README.md) for the full examples archaeology.
