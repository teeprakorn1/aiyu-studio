# Guide: the dot-matrix globe

`features/globe.js` draws a rotating Earth made of dots — land bright, ocean faint —
with great-circle arcs and markers pinned to real lat/lon coordinates. It is the
modern/tech counterpart to the parchment map system in
[04-maps.md](04-maps.md): same geographic truthfulness, completely different visual
language. Use it for globalization, supply chains, "from X to Y" stories, satellite/
connectivity themes — anywhere a dotted planet reads faster than a flat map.

Technique adapted from [cobe](https://github.com/shuding/cobe) (MIT) — fibonacci
sphere lattice, 1-bit landmask, bezier arc lift, rim-darkened shading — reimplemented
for Canvas 2D. See [../acknowledgements.md](../acknowledgements.md).

## 1. The spec object — one globe, many calls

A globe is a plain spec object; every draw call recomputes rotation from `spec + t`,
so there is no shared state and parallel chunk rendering stays bit-identical:

```js
const GLOBE = { cx: 540, cy: 760, r: 380, spin: .15, face: [13.7, 100.5] };
//              screen centre   px radius   rad/s    [lat, lon] aimed at camera at t=0
```

| Field | Meaning |
|---|---|
| `cx`, `cy` | globe centre in screen px (inside `cam()` these are world coords like everything else) |
| `r` | radius in px — dot count scales with `r²`, so spacing stays ~15 px at any size |
| `spin` | rotation speed in **radians per second** — `.1` is a slow documentary drift, `.5` is brisk |
| `face` | `[lat, lon]` the camera looks at when `t = 0`; the globe then rotates away at `spin` rad/s |
| `phi0`, `theta` | alternative to `face`: raw base yaw/tilt in radians (advanced — prefer `face`) |

`face` wins over `phi0`/`theta` when both are present. Negative `spin` rotates the
other way; `spin: 0` holds the globe fixed (arcs/markers still work).

## 2. The three draw calls

```js
dotGlobe(GLOBE, o.t, { land: '#d8c9a3', ocean: .12, glow: '210,190,140', shade: 1.2 });
globeArc(GLOBE, o.t, [13.75, 100.5], [37.77, -122.42], rv(o, 5), { color: '#e05252' });
globeMark(GLOBE, o.t, [37.77, -122.42], rv(o, 6), { color: '#ffd166' });
```

- **`dotGlobe(spec, t, opts)`** — the planet itself. `opts.land` is the dot color
  (`#rrggbb`), `opts.ocean` is ocean-dot brightness 0..1 (default .12 — raise it if
  the globe floats on a bright background), `opts.glow` is an optional `'r,g,b'`
  atmospheric halo, `opts.shade` controls limb darkening (default 1.2), `opts.dots`
  overrides the point count (default `r²/14`, clamped 600–16000).
- **`globeArc(spec, t, from, to, p, opts)`** — a great-circle arc between two
  `[lat, lon]` points, lifted off the surface as a quadratic bezier. `p` is reveal
  progress 0..1 — drive it with `rv(o, n)` so the arc draws itself as the narrator
  names the destination. `opts.height` (default .32 of `r`) controls the lift,
  `opts.width` the stroke px.
- **`globeMark(spec, t, latlon, p, opts)`** — a marker dot + expanding pulse ring at
  a `[lat, lon]`. Same `p` reveal contract. `opts.size` (default 6 px) and
  `opts.elev` (default .02 of `r`) tune it. Automatically hidden when the point
  rotates behind the globe.

Both `globeArc` and `globeMark` take `t` separately from `p` on purpose: `t` drives
the globe's rotation (the arc must stay glued to the turning planet), while `p`
drives only the reveal. Pass `rv(o, n)` for `p`, never seconds.

## 3. Coordinates and orientation

All positions are **real `[latitude, longitude]` in degrees** — `[13.75, 100.5]` is
Bangkok, `[-33.8, 151.2]` is Sydney, longitude wraps (190 ≡ -170). The landmask is a
1-bit 256×128 equirectangular map baked into the module (~5 KB base64), so there are
no assets to ship and no network fetches — it works over `file://` like everything
else.

Orientation sanity check: with `face: [13.7, 100.5]`, Bangkok sits dead centre at
`t = 0` and New York/Johannesburg start on the far side. If your story is about a
place, `face` it — do not guess `phi0`/`theta`.

## 4. Compositing recipe

The globe is just canvas calls — layer it like anything else:

```js
cam(o, { z0: 1.02, z1: 1.1, cy: 980 }, () => {
  skyStops([[0, '#0B1026'], [.6, '#1B2A4A'], [1, '#0A0D18']], 0, 1240);
  starField(140, 7, 1100, o.t);
  const GLOBE = { cx: 540, cy: 700, r: 360, spin: .14, face: [20, 20] };
  dotGlobe(GLOBE, o.t, { land: '#cfe0ff', ocean: .1, glow: '120,160,255' });
  // arcs and markers go AFTER dotGlobe so they draw on top
  globeArc(GLOBE, o.t, [20, 20], [40.7, -74], rv(o, 3), { color: '#7fd4ff' });
  globeMark(GLOBE, o.t, [40.7, -74], rv(o, 4), { color: '#ffd166' });
});
```

- Draw `dotGlobe` **before** arcs/marks; marks are hidden automatically when they
  rotate behind the disc, but arcs clip to the silhouette so ordering still matters
  for overlapping arcs.
- Keep the globe inside `cam()` when it should drift/zoom with the scene; put it
  outside when it must stay screen-locked.
- Performance: ~1.5–2 ms per frame at default density (measured, software
  rendering). If you need several globes, drop `opts.dots` — spacing stays even.
- The landmask fills both polar caps as land (inherited from the source texture) —
  this reads as ice caps and is intentional.

## 5. Determinism notes

- The fibonacci lattice and landmask are precomputed **once** at first use and
  cached; rotation is a pure function of `t`. Same `t`, same pixels, every chunk.
- Do not mutate the spec object between calls — all three functions read it
  fresh each frame.
- `globeArc`/`globeMark` use `Math.sin` for the marker pulse (same precedent as
  `atmosphere.js`); the lattice itself is pure IEEE arithmetic.
