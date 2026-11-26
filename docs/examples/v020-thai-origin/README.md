# thai-origins — the cinematic production (v0.2.0 era)

A 2:06 Thai-language vertical documentary short about the origins of the Thai people,
driven entirely by canvas-drawn scenes: an animated parchment map (Natural Earth
coastline data, hachure mountains, migration flow paths), dusk city scenes with
realistic walk-cycle humans, living water, and film-grain frame treatments.

**Production code:** [examples/legacy/thai-origins/](../../../examples/legacy/thai-origins/)

## In this folder

| File | Contents |
|---|---|
| [01-thai-pipeline.md](01-thai-pipeline.md) | production notes — the seven scenes, the map system, the five cinematic rules (each was a mistake first), the pits, and the extraction archaeology of how this film became v0.2.0 |

## What this production gave the template

This film's techniques were so successful they **became the template** — they are
current documentation, not just history:

| Invented in this production | Where it is documented now |
|---|---|
| `personTH()` realistic humans, layered backgrounds, water system, frame treatments | `template/features/people.js` + `atmosphere.js` — guide: [../../authoring/03-cinematic.md](../../authoring/03-cinematic.md) |
| Animated data-driven map system (projection, hachure, focusCam, flow paths) | technique guide: [../../authoring/04-maps.md](../../authoring/04-maps.md) |
| `rv()` line-scoped reveal | now part of the core runtime — [../../authoring/01-scenes.md](../../authoring/01-scenes.md) |

## What to study in the code itself

- `style.js` — 1,582 lines: the full production scene file, with the original inline
  helpers the modules were extracted from (the comments explain the why)
- `mapdata.js` — simplified Natural Earth coastline/river data for SE Asia
- `thumb.html` — bespoke thumbnail painter reusing `people.js`

The layout is a **v0.2.0 fossil** (flat scripts, pre-split runtime) — read the code,
never copy the organization. See [../README.md](../README.md) for the full examples
archaeology.
