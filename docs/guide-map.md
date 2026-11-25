# Guide: building animated data-driven maps

How the `thai-origins` map system works — an animated parchment-style map of Southeast Asia
with real geography, migration flow paths, city markers and archival hachure mountains,
all drawn in canvas code. Everything lives in `examples/thai-origins/style.js` — copy the
pieces into your own `style.js` and adapt.

```
Map layers, back to front (mapBase):
ocean gradient → coastal shelf glow → land shadow → land gradient (clipped)
→ hachure mountains → rivers → crisp coastline → graticule → optional dim
then per-scene: influence blobs → flow paths → city markers → label plates
```

## 1. Map data — where geography comes from

`mapdata.js` is a single `const MAPDATA = {...}` (~590 KB) with simplified
[Natural Earth](https://www.naturalearthdata.com/) geometry in lon/lat pairs:

| Key | Contents |
|---|---|
| `MAPDATA.land` | array of closed rings (polygons) — mainland + large islands, used for fills |
| `MAPDATA.coast` | array of open polylines — coastlines, used for strokes and shelf glow |
| `MAPDATA.rivers` | object: river name → array of polylines (Mekong, Chao Phraya, Salween, Mun, Chi, Ping, Yom, Mae Klong, Tonle Sap) |

To make your own regional dataset: export the region from Natural Earth (or geojson
sources), simplify aggressively (map data at video resolution needs very few points —
the thai-origins data is already simplified to what a 1080×1920 frame can show), then
dump as the JSON structure above.

### The tiny-island trap (important)

Real coastline data contains **tiny closed rings** — small delta islands. When stroked
with wide glowing passes they collapse into scratchy fans of lines (this produced a
visible "hair scribble" artifact at the Mekong delta in production). Filter them out
when building paths:

```js
MAPDATA.coast.forEach(line => {
  // drop tiny closed islet rings (they render as scratchy fans)
  const [f0, l0] = [line[0], line[line.length - 1]];
  const closed = Math.abs(f0[0]-l0[0]) < .01 && Math.abs(f0[1]-l0[1]) < .01;
  if (closed && line.length < 60) {
    // measure bounding box; skip if smaller than ~1 degree
    ...
    if ((maxLo-minLo) + (maxLa-minLa) < 1.1) return;
  }
  ...
});
```

## 2. Projection — lon/lat to screen

A simple equirectangular projection with latitude scaling correction:

```js
const MK = 60, MLON = 101, MLAT = 13, MCOS = Math.cos(13 * Math.PI/180);
const MX = lon => 540 + MK * MCOS * (lon - MLON);
const MY = lat => 900 - MK * (lat - MLAT);
```

- `MK` — pixels per degree (zoom base). 60 means ~11 degrees of longitude across the frame width
- `MLON/MLAT` — the lon/lat that sits at the anchor point (540, 900)
- `MCOS` — cos(center latitude): longitudes compress toward the poles, so multiply x by cos φ or the map looks stretched east-west. Compute it at the *center* latitude of your region

Everything geographic is then written in lon/lat and converted through `MX()/MY()` —
cities, ridge lines, flow endpoints — so the whole map stays geographically truthful.

### Precompute Path2D once

All rings/polylines are converted into `Path2D` objects **once at load time**
(`LAND_P`, `COAST_P`, `RIVER_P`, `LAND_ALL`). Never rebuild paths per frame — Path2D
creation is the expensive part; stroking/filling them is cheap. `LAND_ALL` is the union
used for clipping (see §3).

## 3. mapBase — the layered base map

Drawn every frame inside the camera transform. Each layer earns its keep:

1. **Ocean gradient** — vertical, full-bleed beyond the camera (`-700..W+1400`) so no
   edge ever shows during zoom/drift
2. **Coastal shelf glow** — the coast polylines stroked 3 times at widths 28/16/8 with
   alpha .025/.04/.06. This is the "shallow water" halo along shores — cheap and very effective
3. **Land shadow** — land polygons filled once with `shadowBlur: 22` so the landmass
   lifts off the ocean
4. **Land gradient, clipped** — `g.clip(LAND_ALL)` then a vertical 3-stop gradient
   (lighter north → darker south). Clip-then-fill-rect is how you gradient-fill an
   arbitrary union of polygons
5. **Hachure mountains** — see §4
6. **Rivers** — each river stroked twice: a dark understroke at `w+2.4` alpha .5, then
   the main stroke. The understroke separates the river from the land texture underneath.
   Widths/alphas per river form a hierarchy (`RIVER_H`): Mekong 4.2px/.5 down to
   Mae Klong 1.7px/.28 — not all rivers are equal
7. **Crisp coastline** — final 1.4px stroke at alpha .55 over everything
8. **Graticule** — faint lat/lon grid (alpha .05) for the cartographic feel
9. **Optional dim** — `mapBase(o, { dim: .3 })` darkens everything, used when a scene
   wants the map as background texture rather than the subject

## 4. Hachure mountains — archival cartography style

The first implementation drew translucent ribbons along ridge lines — they looked like
glowing worms and ruined the map. The fix: **hachures**, the little peak marks of
19th-century maps.

```js
const RIDGES = [
  [[[97.4,21],[98.2,20],[99.2,19.2],[100,18.4]], 90, .14],  // [polyline in lon/lat], size, alpha
  ...
];
```

For each ridge line: walk the polyline in ~18px steps, and at each sample point draw one
small asymmetric peak — a quadratic-curve mound, randomly sized/rotated/offset via
`srnd()` seeds. Two passes per peak:

- **fill** — dark `rgba(8,18,12, a*2.8)` (the shadowed side)
- **partial stroke** — lighter `rgba(165,190,135, a*1.5)` along the left/up slope only
  (the lit side) — this single-sided highlight is what makes them read as relief

Key details: jitter positions with `srnd` so peaks don't form a ruler-straight chain;
scale peak size by the ridge weight; rotate each peak slightly. The result reads as a
mountain range at a glance without any shading complexity.

## 5. focusCam — geographic camera framing

`cam()` works in screen space, but map scenes think in lon/lat. `focusCam` bridges them:
it computes the camera offset needed to place a given lon/lat at a given screen position,
then delegates to `cam()`:

```js
focusCam(o, 100.6, 16.5, 540, 880, 1.12, 1.22, () => {
  mapBase(o, { dim: .3 });
  // ...scene content in map coordinates
});
// → (lon 100.6, lat 16.5) sits at screen (540, 880), zoom drifts 1.12→1.22
```

Because the offset is `sx - MX(lon)`, the target stays glued to its screen position while
`cam()`'s zoom/punch/drift animate around it. Scenes never compute camera math themselves.

## 6. organicBlob — influence zones without borders

Historical influence zones have no hard boundaries, so never draw them as ellipses or
polygons with solid edges:

- 22 vertices around a circle, radius modulated by two sine harmonics
  (`1 + .09·sin(3a+seed) + .05·sin(5a+seed)`) — enough irregularity to read as organic
- smooth closed curve through midpoints (quadratic curve smoothing)
- **fill**: radial gradient fading to alpha 0 at the edge — no visible boundary
- **edge**: thin dashed stroke, `lineDashOffset` animated by time so the dash slowly
  crawls — reads as "approximate, contested, alive"
- entrance: scale-up from 60% + alpha ramp with `ease(p)`

## 7. flowPath — migration/flow arrows

The signature element: a tapered, luminous, animated path along a quadratic bezier.

```js
flowPath(x1,y1, cx,cy, x2,y2, col, w, p, o, seed);
//        start      control     end    color width progress scene-obj
```

Anatomy (three passes + particles + arrowhead):

1. **glow pass** — same path at width `+5` with `shadowBlur: 18` in the path color
2. **core pass** — the main stroke; width **tapers** from `w*1.15` at the tail to `w*.5`
   at the head (lerp by t) — taper is what makes it read as movement, not a hose
3. **inner highlight** — pale `#FFF4DC` narrow stroke down the center
4. **traveling particles** — 4 additive-blended dots at `t = (o.t*.25 + k*.25) % 1`
   along the path, fading toward the head — the sense of a stream of people
5. **arrowhead** — appears only when `p > .9`: two quadratic-curved barbs (not straight
   lines — curved barbs look like a brush stroke)

All passes are drawn **segment by segment** (N=34 samples) because canvas can't taper a
single stroke — each segment gets its own `lineWidth`. The path reveals progressively:
`upto = floor(N * p)` segments, driven by dialogue progress.

## 8. cityMark + labelPlate — settlements

```js
cityMark('sukhothai', p, { capital: true });
labelPlate('สุโขทัย', x, y, 30, '#F0E0B8', PAL.gold);
```

cityMark layers: soft radial halo → expanding entrance pulse ring while `p < 1` → bronze
ring → bright gold core. Capitals get bigger radii. Cities are data-driven from a
`CITY` table of lon/lat + Thai names, so scenes reference them semantically
(`cityMark('lavo', ...)`) and never hand-place pixels.

`labelPlate` (in atmos.js): text centered on a dark rounded plate with optional accent
bar — the only reliable way to keep labels readable over a busy map.

## 9. rv() — reveals driven by narration

```js
const rv = (o, n, r = 1.7) => o.i < n ? 0 : o.i === n ? Math.min(1, o.lp * r) : 1;
```

`rv` lives in `rig.js` as a `window` property (see [guide-scenes.md §3](guide-scenes.md)). It returns 0 before line `n`, ramps 0→1 during it, and stays 1 after. Every map element's reveal is tied to a dialogue line index, so when the narrator mentions a city the city appears and stays. Binding to **line indices**, not seconds, means re-timed audio re-times the whole choreography automatically.

> `rv` is exported through `window`, so the copy in `examples/thai-origins/style.js` (or any copied `const rv`) shadows it without an error.

## 10. parchmentInset — miniature map cards

For close-up storytelling, a parchment card overlaid on the main scene containing a
*second, independent mini-map*: its own simpler linear projection (`mmx/mmy` mapping a
fixed lon/lat window into card space), reusing the same `MAPDATA` but skipping
out-of-window points (`if (lo < 98.6 || ...) { started = false; return; }` — note you
must restart the path after clipping gaps or lines will spider across the card).
Plus parchment texture: 26 seeded hair-thin fiber strokes at alpha .05, and a shadowed
rounded card. Cards enter with `ease(p)` alpha.
