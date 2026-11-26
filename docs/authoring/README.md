# authoring — writing the story

The creative half of the pipeline: everything inside `story/` plus the runtime API the
scenes are built from. Files are numbered in suggested reading order, but audio and
scene work actually proceed **in parallel** in real productions.

| File | Contents |
|---|---|
| [01-scenes.md](01-scenes.md) | anatomy of `style.js`, the SC table, the `o` object, `cam()` and the zoom trap, `person()`, chips, footnote, safe zones, copying code across projects |
| [02-dialogue-audio.md](02-dialogue-audio.md) | `dialogue.txt` format, `segments.json` mapping, TTS voice generation, the `tempo` knob, two-mode (stub/real) workflow |
| [03-cinematic.md](03-cinematic.md) | choosing a character renderer, `personTH` anatomy, the layered-background recipe, the water system, frame treatments in fixed order |
| [04-maps.md](04-maps.md) | animated data-driven maps — Natural Earth data, projection, `mapBase`, hachure mountains, `focusCam`, migration flow paths, reveal choreography |
| [05-parameterized.md](05-parameterized.md) | parameterized rendering — many visual variants from one project: the data-module pattern, batch workflow, what can and cannot vary |

## Prerequisites

[../getting-started/01-quickstart.md](../getting-started/01-quickstart.md) — these guides
assume a scaffolded project that already runs the demo.

## Keep open while writing

[../../template/README.md](../../template/README.md) — the compact scene cheatsheet and
the full `person()` parameter table.
