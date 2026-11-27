# Guide: writing scenes in style.js

`story/style.js` is the main scene file rewritten per project — the `core/` + `features/` runtime already contains all machinery. **Never edit core/ or features/** (if you need extra props/backgrounds, copy them from `examples/legacy/jensen-legend/style-v4.js` into your `story/style.js`)

## 1. File anatomy — configuration and scenes

```js
const CH = { ... };            // mascot/presenter character definitions
defineCharacters(CH);          // explicit runtime registration
function scXxx(o) { ... }      // one function per scene
defineScenes([[3, scOpening], [Infinity, scXxx]]);
setFootnote('...');            // faint fine print at y≈268 (empty = hidden)
```

`defineCharacters()`, `defineScenes()`, `definePeople()`, `defineSourceChips()`, and `setFootnote()` are the public story-configuration API. Registration is explicit in new projects. Legacy `CH`/`SC`/`PCH` globals are still adopted as a compatibility fallback, but new work should use the registration functions directly.

## 2. The SC table — wiring scenes to the script

```js
defineScenes([[3, scOpening], [8, scTalk], [Infinity, scClosing]]);
```

Read as: **scOpening covers lines 0–2, scTalk covers 3–7, scClosing covers 8–end**
(each number is "the first line of the NEXT scene" — always end with Infinity)

Rows must be sorted by increasing line number and end with `Infinity`; `defineScenes()` validates this loudly instead of letting a misordered table render the wrong scene.

Scenes are not defined in seconds — **they bind to dialogue lines**, because line timing shifts with the real audio. Speed up the tempo and scenes shrink automatically. This is why the whole system rescales from a single parameter.

## 3. The `o` object each scene receives

| Field | Meaning | Typical use |
|---|---|---|
| `o.t` | current time (seconds) | continuous animation, e.g. `blink: (o.t % 3.4) < .12` |
| `o.p` | scene progress 0→1 | zoom/reveals, e.g. `pop(..., Math.min(1, o.p * 2))` |
| `o.i` | current dialogue line index | progressive reveals: `if (o.i >= 2) TXT(...)` |
| `o.lp` | progress within the line 0→1 | fading chips/cards with the speech |
| `o.line` | current line {spk, txt, t0, dur} | checking who speaks |
| `o.em` | audio envelope right now 0..1 — **0 in the gaps between lines** | used via mouthFor(); rarely touched directly |

**Reveals that must not re-animate:** `rv(o, n, r)` returns 0 before line `n`, ramps 0→1 during it, and stays 1 after. Use it for anything that appears at a line — feeding `o.lp` directly restarts the animation every time the narration advances.

```js
if (rv(o, 6, 3)) quoteCard(lines, rv(o, 6, 3), 560);   // appears at line 6, then stays
```

## 4. cam() — the camera (wraps background + characters)

```js
cam(o, { z0: 1.05, z1: 1.13, x0: 0, x1: 0, cy: 1000, cx: 540,
         punch: .02, punchDur: .55, driftX: 5, driftY: 4, phase: 0 }, () => {
  // draw background + characters inside here
});
```

- `z0→z1` slow zoom-in across the scene (1.04–1.14 is the production range — don't exceed it)
- `punch` a zoom kick at each new line — keeps the frame alive as the narrator moves between sentences
- `driftX/Y` slow floating so the frame never feels frozen
- `cy` the zoom center — **critical for safe zones, see below**
- Place text/cards **outside** cam if you don't want them moving with the camera

## 5. person() — characters

```js
person('host', { x: 540, y: 1600, scale: 1, t: o.t,
  look: 1,              // facing direction -1..1
  flip: false,          // mirror horizontally (for two characters facing each other)
  back: false,          // back turned (cold opens)
  blink: (o.t % 3.4) < .12,
  mood: 'neutral',      // neutral smile worry hurt tense resolute
  mouth: mouthFor('H', o),   // mouth moves only when spk matches this letter
  pose: 'idle',         // idle fold point open (or arms: [[a,b],[a,b]] for custom angles)
  walk: false, sit: false });
rim(540, 1600, 1, 1, 'rgba(118,185,0,.4)');   // rim light — separates character from dark backgrounds
```

Character definitions are plain objects registered with `defineCharacters()` — key fields: `hs` hairstyle (`jensen|swoop|bob|blonde|longF|pony|none`), clothing `jacket|suit+tie|blazer|dress+floral`, extras `glasses lashes earring ghost bw young`

### The lip sync lesson (paid for in production)

`mouthFor('H', o)` returns 0 while anyone else speaks — pass `mouth: o.em` directly and **every character chews along with the narrator**, which looks wrong instantly. Always use mouthFor, and the letter must match spk in dialogue.txt.

## 6. Cinematic upgrade — `features/atmosphere.js` & `features/people.js`

Two optional modules ship in the template and are already loaded by `index.html`.
They were extracted from the real production in `examples/legacy/thai-origins/` — read that
example's README for the full story.

**`features/atmosphere.js`** — atmosphere & nature: `skyStops()` multi-stop skies, `hillsLayer()` /
`treeMass()` / `cloudsDusk()` / `birdsFlock()` for living horizons, `waterBody()` +
`ripples()` + `lightReflection()` for water, `smokeColumn()` / `motes()` / `starField()`
for air. Frame treatments: `captionScrim()` inside the scene (before subtitles), then `screenVig()` outside `cam()`, then `grainLayer()` last
(always draw them last, in that order; see the aiyu-cinematic skill). See the module
header for copy-paste recipes.

**`features/people.js`** — `personTH()` as an alternative to the runtime's `person()`:

```js
personTH('merchant', { x: 540, y: 1560, scale: 1, t: o.t,
  walk: true,       // boolean — stride position is (t*walkSpeed+phase)%1; .25 = max leg spread
  walkSpeed: 1, look: 1, blink: (o.t % 3.4) < .12, mood: 'neutral' });
```

Choose per project: `person()` mascot proportions suit presenter/news formats
(jensen-legend); `personTH()` realistic proportions suit historical/cinematic stories
(thai-origins). They can even mix in one film.

> Deep dives: [03-cinematic.md](03-cinematic.md) for humans/backgrounds/water/frame treatments, [04-maps.md](04-maps.md) for the animated map system.

**Hard-won production rules** (also in the module comments):

- Depth comes from **color mixing toward the horizon color** (`mixHex`), never from
  lowering alpha — alpha-faded objects read as ghosts
- Never use `Math.random()` in scenes — use `srnd()` seeds, or frames flicker and
  chunk-parallel rendering breaks
- Clouds must be wide flat overlapping strips; round shaded discs read as UFOs
- Large text/props should be sized in explicit pixels — relative sizing surprises at scale

## 7. What the runtime already gives you

**Drawing primitives:** `TXT RRECT CIRC LIMB LINE SHAPE PATH` · **scenery/effects:** `wall floorY win glow city stars lamp rain circuitField rim vig tint zoom cam` · **cards/props:** `nameCard newsCard emailCard quoteCard pop chip chartCard` · **systems:** `subs sourceChips footnote mouthFor shot render`

**Helpers:** `srnd(seed)` seeded value in [0,1) · `noise2(x, y)` smooth field, about -1..1 · `mixHex(a, b, p)` and `hexA(hex, a)` take `#rrggbb` only and throw on anything else · `clamp01(v)` · `lerp(a, b, p)`

Special-purpose props built in production (paperSheet, wallClock, routeCurve, cargoShip, serverRack, gpuChip, photoCard, docBadge, doorLight + 12 backgrounds like bgHQ/bgOffice) — copy them from `examples/legacy/jensen-legend/style-v4.js` as needed.

## 8. Safe zones — the rules that make videos readable on phones

<a id="safe-zone"></a>

```
┌──────────────────────┐
│ 0–260 px   EMPTY     │ ← status bar/app icons (footnote sits at y≈268)
│ y≈300/354  source    │
│            chips     │
├──────────────────────┤
│   CONTENT ZONE       │
│   headings/cards/    │
│   characters         │
├──────────────────────┤
│ y≈1490 last subtitle │ ← max width 840px, 120px side margins
│ below      EMPTY     │ ← app buttons/captions overlap here
└──────────────────────┘
```

### ⚠ The cam() zoom trap — the most expensive lesson in production

Written coordinates ≠ on-screen positions, because zoom pulls everything toward (cx, cy):

```
actual = cy + (val − cy) × zoom
```

Real example: a heading at y=300 inside cam(cy=1060, z=1.13) → on screen `1060 + (300−1060)×1.13 ≈ y 200` — **silently floating into the top forbidden zone mid-scene**

How to stay safe:
1. **Scrub the scene live in `preview.html` first** — free and instant, no render at all: drag through the timeline and watch headings/cards while the camera zooms. Most collisions are visible here in seconds
2. Render stills of every scene **before** any real render — `npm run stills -- t1,t2,...`
3. Overlay a red line at y=250 and yellow at y=1570 on the contact sheet and scan by eye (or inspect each still)
4. After any fix, re-check ALL stills, not just the fixed spot — moving one element affects others in the same scene

## 9. Subtitles — fully automatic, nothing to do

The runtime handles everything: Thai word-breaking via Intl.Segmenter, line balancing, font shrink 52→40px when exceeding 3 rows, max width 840px. To check which lines overflow: `npm run check-subs` — needs `talk.js`; prints the widest lines, exits with code 2 if any line overflows the 840px frame.

## 10. Battle-tested scene patterns from production

| Goal | Pattern |
|---|---|
| Cold open 0–3 s | back-turned character + big pop hook text + rim light |
| Two-character dialogue | x positions ~450px apart, right one `flip: true` + mouthFor with separate spk |
| Documents/news beats | character shrinks, cards appear one by one via `o.i` |
| Closing | slow zoom-in + two lines of big text + darkening tint |

Full implementations: `template/story/style.js` (compact examples) and `examples/legacy/jensen-legend/style-v4.js` (19 real scenes)

## 11. Motion curves — making reveals feel premium

The runtime ships deterministic pure functions of progress `p` (0..1) — same input, same output, safe for parallel chunk rendering:

| curve | feel | use for |
|---|---|---|
| `ease(p)` | cubic ease-out, never overshoots | alpha/fades (default) |
| `easeInOut(p)` | symmetric gentle ramp | camera moves, continuous motion |
| `easeBack(p)` | slight overshoot (~1.1) then settle | snappy pop-ins |
| `easeElastic(p)` | rubber-band wobble | playful beats (sparingly) |
| `springy(p, stiffness, damping)` | exact damped-spring physics (~20% overshoot at defaults 170/12) | cards, headings, anything that should feel physical |

Rules of thumb:

- **scale/position** may overshoot → spring/back curves are safe there
- **alpha** must never exceed 1 → keep `ease()` for opacity
- cards (`nameCard`/`newsCard`/`emailCard`) and `pop()` already use `springy` internally for scale — you get the premium bounce for free; reach for the primitives when animating your own elements:

```js
const sp = springy(rv(o, 4, 2));   // physical pop-in tied to line 4
g.save(); g.translate(x, y); g.scale(sp, sp); g.globalAlpha = ease(rv(o, 4, 2));
// draw your element…
g.restore();
```

## 12. Name collisions when copying code

Runtime files are IIFE-wrapped and expose their public API through `window`/`globalThis` (`W`, `H`, `g`, `ease`, `springy`, `personTH`, `skyStops`, `rv`, …). They do **not** create top-level lexical bindings, so copied legacy code that declares `const srnd` or `const mixHex` no longer throws a cross-script redeclaration `SyntaxError`.

That does not make shadowing safe: a local `const ease`, `const srnd`, or `const personTH` in `style.js` wins inside that file and can silently change which implementation your scene uses. When copying old production code, remove duplicate helper declarations unless the copy intentionally overrides the runtime helper. Prefer the shared implementations in `core/base.js` and the optional modules.

## Keyword-beat reveals: rvw()

`rv(o, n)` starts every reveal at line start. When the line carries word timing (see
dialogue-audio §6b), `rvw(o, n, needle)` starts the reveal at the moment the keyword is SPOKEN:

```
const p = rvw(o, 4, '42');         // pops exactly on the spoken figure
if (p > 0) statCard(ctx, easeBack(p));
```

Fallback contract: missing word timing or an unmatched needle degrades to `rv(o, n)` exactly —
scenes never break, they just become line-granular. Needles match with substring tolerance both
directions (Thai subword chunks); repeated words hit the first occurrence. `wordT(ln, needle)`
returns the absolute seconds for custom logic.
## Hand-drawn sketch annotations

`features/sketch.js` gives five drop-in primitives — conversions are one-line changes:

```
// before: plain card frame          // after: hand-drawn frame
g.strokeRect(x, y, w, h);            sketchRect(x, y, w, h, {seed: 901});
// bar chart bar edge                 sketchLine(x, yBase, x, yTop, {seed: 940 + i});
// map route                          sketchArrow(x1, y1, x2, y2, {seed: 970, rough: 1.4});
// number emphasis                    sketchCircle(cx, cy, r, {seed: 988, boil: 3, t});
```

Options: `rough` (1 = subtle hand shake), `bow` (line warp), `boil` (frames per redraw — squigglevision,
pure function of t, chunk-safe but costs bitrate). **Seed law:** derive from the shape's role
(`9000 + sceneIdx*37 + shapeIdx`), never the frame — frame-derived seeds break parallel chunks.
Technique adopted from rough.js; dense fills deliberately excluded (compression shimmer).
