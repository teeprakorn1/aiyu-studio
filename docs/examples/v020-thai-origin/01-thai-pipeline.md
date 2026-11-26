# Real production pipeline: thai-origins (historical record)

> ⚠ **Read first:** this is a historical production record — **all principles still apply**, but several mechanics differ from the current template:
>
> | In this document (original production) | Current template |
> |---|---|
> | atmosphere/water/sky helpers inline inside `style.js` | extracted into `template/features/atmosphere.js` — guide: [../../authoring/03-cinematic.md](../../authoring/03-cinematic.md) |
> | production version of `people.js` (plain globals) | `template/features/people.js` — IIFE-wrapped with window exports, safe to copy beside |
> | `rig.js` single runtime file | split into the `core/` + `features/` 3-layer runtime (never edit) |
> | map elements revealed by hand-timed keys | `rv()` line-scoped reveal now lives in the core runtime — [../../authoring/01-scenes.md](../../authoring/01-scenes.md) |
> | `style.js` / `dialogue.txt` / `segments.json` at project root | author inputs live in `story/` |
>
> Reconstructed from the production's own artifacts — code, embedded comments and the
> lessons recorded at extraction time. (Unlike the jensen-legend notes, which were
> written while the work happened.)

---

## Pipeline as run for `thai-origins` (vertical 1080×1920, 2:06, Thai-language)

### 1. System data flow

```
dialogue.txt (23 lines, single narrator spk=M)
        │
        ▼  voice generated in AI Studio (manual)
vo/*.wav — 1–2 lines per file (24kHz mono s16le)
        │
        ▼  mix_studio.py  (tempo 1.2, gap 0.05, lineGap 0.06)
talk.js (t0/dur/spk/env) + narration.wav
        │
        ▼  index.html — loads talk.js, srchips.js, mapdata.js, rig.js, people.js, style.js
        │  everything reads time from TALK only
        ▼  render.mjs (stills) / publish.mjs (parallel chunks)
out/*.mp4 chunks
        │
        ▼  mux.mjs — concat + loudness + faststart
final.mp4
```

The same single-truth principle as jensen-legend: subtitles, scene boundaries and
duration all derive from `talk.js`. What this production added was **visual** — the
canvas stopped looking like a diagram and started looking like a film.

### 2. Files and their roles

| File | Role |
|---|---|
| `dialogue.txt` | 23-line script, single narrator — no character voices needed, which made this the wrong production to test lip sync but the right one to test pure visuals |
| `segments.json` | tempo **1.2**, gap 0.05, lineGap 0.06 — a faster, denser pace than jensen-legend (documentary narration, no dialogue pauses) |
| `mapdata.js` | simplified Natural Earth coastline/river data for SE Asia (~590 KB) — the hand-built geography input of the map scenes |
| `style.js` | 1,582 lines: the entire visual invention of v0.2.0 lives here — map system, sky/water/grain helpers, period props, 7 scenes |
| `people.js` | first version of `personTH()` — realistic-proportioned humans |
| `rig.js` | the v0.2.0 runtime, unmodified — the production's rule was already "never edit the rig" |
| `thumb.html` | bespoke thumbnail painter reusing `people.js` to draw a large character plus a myth-busting crossed-out headline |

### 3. The seven scenes

| Lines | Scene | What it is |
|---|---|---|
| 0–1 | `scHook` | the myth stated, then struck through — the film's thesis in 8 seconds |
| 2–5 | `scLandBefore` | the cinematic parchment map of SE Asia, a thousand years back |
| 6–8 | `scMerchant` | merchant in a canal city at dusk — water, stilt houses, lamps |
| 9–14 | `scStreams` | migration flow paths with traveling particles, influence blobs, mixing |
| 15–16 | `scSukhothai` | the gathering network — city markers pulsing awake |
| 17–20 | `scAyutthaya` | the port at its peak + parchment inset |
| 21–22 | `scClosing` | the shared table — the question handed back to the viewer |

### 4. The map system (the largest invention)

Real geography, not decoration: Natural Earth coastline and river data, simplified by
hand into `mapdata.js`, projected lon/lat → screen, then drawn in archival-cartography
layers — ocean full bleed, coastal shelf glow in 3 passes, land shadow, vertical
gradient clipped to land, hachure mountain marks along ridge polylines, rivers
dark-understroked then main-stroked, crisp coastline, faint graticule.

On top of the base map: `focusCam` geographic camera framing, tapered luminous flow
paths with traveling particles and barb arrowheads, city markers with halo + bronze
ring + entrance pulse, organic influence blobs (never ellipses) with radial fill and
thin dashed edges.

**The tiny-island trap:** real coastline data contains tiny closed rings — delta
islands. Stroked as-is they render as scratchy hair-scribble fans (first visible at the
Mekong delta). They must be filtered out by area when building paths. This trap is
documented in [../../authoring/04-maps.md](../../authoring/04-maps.md) because it will
bite anyone who feeds real map data into the system.

### 5. The cinematic rules (invented here, now law)

These are written as rules in authoring/03-cinematic — each was a mistake first:

1. **Depth comes from color mixing, never alpha.** Early silhouettes were drawn with
   reduced alpha — they read as ghosts and layering showed through. The fix: draw opaque,
   `mixHex()` toward the horizon color; more distant = more mix, never less alpha.
2. **Clouds must be wide flat overlapping strips.** Round shaded discs read as UFOs —
   discovered the hard way. `cloudsDusk` draws 6 overlapping flat ellipses (rx ≈ 5× ry)
   per cloud, low alpha, no bright rims.
3. **Every layer moves at its own speed** — parallax is what separates "diagram" from
   "film".
4. **Reflections are not optional.** Water without reflections looks wrong even when
   viewers cannot say why.
5. **Frame treatments always last, in fixed order** — grain (procedural, offscreen tile
   at low alpha), vignette, caption scrim.

### 6. The humans

`personTH()`: ~5.5-head proportions instead of the mascot's chibi ratio, jointed limbs
with real knees/elbows, config-driven characters. The walk cycle genuinely alternates
legs — phase `.25` is maximum leg spread mid-stride, so any keyframed pose must snap to
the same phase or the walk glitches. Background walkers are drawn opaque and
color-mixed (rule 1) — at small scale in dusk light, skin-tone differences vanish into
the mix anyway.

### 7. Pits fallen into this production (don't repeat)

- **Alpha-faded distant silhouettes** → ghosts. Color-mix instead (rule 1)
- **Round shaded clouds** → UFOs. Wide flat strips (rule 2)
- **Tiny closed coastline rings** → Mekong delta hair-scribble. Filter by area
- **The junk ship originally sat low** — its sail hid behind the caption scrim. Raised
  foreground props must respect the subtitle zone
- **Stilt houses need visible stilts into the water** — without them they float
- **Walk poses keyed off-phase** → legs glitch. Snap keys to phase .25

### 8. The extraction — how a production became v0.2.0

The template did not gain these techniques by design meeting; they were proven here
first and extracted afterwards:

| Extracted | From | Into |
|---|---|---|
| sky/haze/hills/water/smoke/motes/grain/vignette/scrim helpers | inline sections of `style.js` | `template/features/atmosphere.js` |
| `personTH()` | `people.js` verbatim | `template/features/people.js` (IIFE-wrapped) |
| `rv()` line-scoped reveal | hand-timed map choreography | the core runtime itself |
| the map techniques | `scLandBefore`/`scStreams` | technique guide [../../authoring/04-maps.md](../../authoring/04-maps.md) — the data stays per-project |

**The pattern to repeat:** build the film first, invent what the story needs, extract
what proves reusable. That is how this template has grown from the beginning.
