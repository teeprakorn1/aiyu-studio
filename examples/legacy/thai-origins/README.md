# thai-origins — cinematic example (v0.2.0)

Complete code from a real production — a 2:06 Thai-language documentary short about the
origins of the Thai people, driven entirely by canvas-drawn scenes: an animated parchment
map (Natural Earth coastline data, hachure mountains, migration flow paths), dusk city
scenes with realistic walk-cycle humans, living water, and film-grain frame treatments.

> **Legacy snapshot — v0.2.0-era layout.** Flat scripts (`rig.js` + `people.js` at
> root), predating the `core/` + `features/` split of v0.3.0. Scene code, dialogue and
> segment mapping remain valid references; do **not** copy the file organization —
> new projects use the `template/` 3-layer layout. See [docs/examples/README.md](../../../docs/examples/README.md).

**No media files in this folder, by design** — `vo/`, `narration.wav`, `talk.js` must be
generated following the main README steps.

## Why this example exists

This production is where the cinematic techniques of v0.2.0 were invented and proven.
Two optional template modules were extracted from it:

| Module | What it gives you | Where it came from here |
| --- | --- | --- |
| `template/features/atmosphere.js` | multi-stop skies, atmospheric haze, hills/tree/cloud/bird layers, water system (ripples, reflections), smoke, motes, starfield, grain, vignette, caption scrim, label plates | inline helpers inside `style.js` |
| `template/features/people.js` | `personTH()` — realistic-proportioned humans with knees/elbows and a correct walk cycle, config-driven characters | `people.js` verbatim |

Key lessons baked into those modules (read the comments in `style.js` for the originals):

- **Depth comes from color mixing, never alpha** — background elements are drawn opaque
  with `mixHex()` toward the horizon color; alpha-faded silhouettes read as ghosts.
- **Deterministic randomness only** — `srnd()` seeds everything; `Math.random()` flickers
  frame-to-frame and breaks chunk-parallel rendering.
- **Clouds must be wide flat overlapping strips** — round shaded discs read as UFOs.
- **Walk cycle**: phase `.25` is maximum leg spread mid-stride; snap keys to the same phase.
- **Small closed coastline rings** in real map data (Mekong delta islands) turn into
  scribbles when stroked — filter them out by area.

## Files

- `style.js` — 1582 lines: the full production scene file (map system + 7 scenes)
- `people.js` — the original production version of the human renderer. It is loaded as a plain global script, so it is used only inside this example folder. `template/people.js` has the same renderer wrapped in an IIFE with window exports; use that one in new projects
- `rig.js` — the v0.2.0 template runtime verbatim, included so the example is self-contained. `rv()` lives here, so `style.js` does not redeclare it
- `mapdata.js` — simplified Natural Earth coastline/river data for SE Asia (~590 KB, required by the map scenes)
- `dialogue.txt` / `segments.json` / `srchips.js` — real script, segment mapping, source chips
- `thumb.html` — bespoke thumbnail painter: reuses `people.js` to draw a large character
  plus a myth-busting crossed-out headline, rendered headless for YouTube/Shorts covers
