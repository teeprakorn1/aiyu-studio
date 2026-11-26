---
name: aiyu-cinematic
description: Cinematic visual features in aiyu-studio — realistic personTH humans, layered atmosphere (skies, water, grain, weather), frame treatments, and copying the map/props patterns from the thai-origins example. Use when building historical, cinematic, or map-driven scenes.
---

# aiyu-cinematic — realistic humans, atmosphere, and map patterns

All rules in `aiyu-authoring` still apply — determinism, talk.js timing, safe zones. This skill covers the optional layer on top.

## Choosing your character renderer

| | `person()` (chibi) | `personTH()` (realistic) |
|---|---|---|
| Proportions | 3 heads — mascot | ~5.5 heads — realistic |
| Limbs | capsules | jointed knees/elbows |
| Walk | simple bob | true alternating stride |
| Best for | presenter/news formats | historical/cinematic stories |

They mix fine in one film — mascot host + realistic story characters.

## personTH essentials

```js
personTH('merchant', { x: 540, y: 1560, scale: 1, t: o.t,
  walk: true,         // stride phase derives from (t*walkSpeed+phase)%1 — deterministic
  walkSpeed: 1.6,     // 1.2 amble · 1.6 walk · 2+ brisk
  flip: false, look: 1, blink: (o.t % 3.4) < .12,
  mouth: mouthFor('M', o) });
```

Characters are registered with `definePeople({ id: {skin, hair, top, ...} })` — same registry pattern as `defineCharacters`.

## The layered background recipe (atmosphere.js)

Build depth with translucent layers back-to-front, each pure in `t`:

1. **Sky** — `skyStops([[0,'#1a2436'],[.55,'#3a2a3a'],[1,'#0c0f18']])` multi-stop vertical gradient
2. **Celestial/depth** — `starField(n, seed, yMax, t)`, `cloudsDusk`, `birdsFlock`
3. **Landforms** — `hillsLayer(yBase, amp, seed, col)` several layers at decreasing alpha = atmospheric perspective
4. **Water** — `waterBody` + `ripples` + `lightReflection` as a system: still reflections of bright elements, moving ripple lines over them
5. **Air** — `motes`, `smokeColumn`, weather (`rain` from environment.js)
6. **Haze bands** — `hazeBand(y, h, color, a)` between depth layers

## Frame treatments — always last, fixed order

After everything else in the scene, in this exact order:

```js
grainLayer(.035);        // film grain — seeded internally, deterministic
captionScrim(.5);        // darkens the subtitle zone so text reads over anything
screenVig(.3);           // vignette — cinematic edge falloff
```

`labelPlate(txt, x, y)` for archival-style caption plaques; `TXTW` is the weighted text variant; `focusGlow` for attention spots.

## Deterministic randomness — the hard rule

Every scatter (stars, motes, trees, raindrops) must be seeded: `srnd(seed)` with a **constant** seed per element family — never `Math.random()`, never seed with `t`. Same seed + same `t` = same frame in every parallel chunk. `grainLayer`, `starField` & co. already follow this internally; when you compose your own scatter, copy their pattern.

| ❌ WRONG — cinematic edition | ✅ CORRECT |
|---|---|
| `srnd(o.t)` — seed changes every frame: stars boil/flicker, chunks disagree | `srnd(31)` constant per family — positions frozen, only brightness/phase animates with `t` |
| animating raindrops by randomizing positions per frame | fixed drop positions from seed + falling offset `= f(t)` |
| one detailed background drawing | ≥4 translucent layers — depth comes from layering, not detail |
| frame treatments scattered through the scene | grain → scrim → vig, once, at the very end |

> 🔴 Flickering elements in the render = seeded randomness violated somewhere. Chunk seams that don't match = same cause. There is no other suspect — hunt the seed.

## Maps — copy from the example, they are not runtime

The animated-map system (parchment base, hachure mountains, flow paths, city markers, `focusCam` geographic camera) **lives in the thai-origins example project, not in features/**. To use it:

1. Copy `mapdata.js` (~590 KB Natural Earth geometry) into your project root and load it in index.html/preview.html script order before style.js
2. Copy the functions you need from the example's `style.js` — `mapBase`, `focusCam`, `flowPath`, `cityMark`, `organicBlob`, `parchmentInset`, hachure helpers — into your own `story/style.js`
3. **Rename-collisions warning**: runtime files expose globals via `globalThis` only, but copied example code with `const`/`function` at top level can collide with each other across files — keep map code inside your single style.js or wrap in an IIFE
4. Copy/adapt freely — the example is a library of patterns, but the layering order (ocean → shelf glow → land shadow → clipped land gradient → hachures → rivers → coastline → graticule) is what makes it look expensive; keep it intact

## Palettes as named systems

Don't scatter raw hex through scenes. Define per-story palette objects (`const PAL = { skyTop: ..., skin: ... }`) at the top of style.js — one place to regrade the whole film.

## The master checklist for a cinematic scene

- [ ] depth comes from ≥4 translucent layers, not one detailed drawing
- [ ] every scatter seeded with constants
- [ ] frame treatments last in fixed order (grain → scrim → vig)
- [ ] walk cycles use `walk:true` + `walkSpeed`, never manual leg math
- [ ] safe zones still respected — cinematic is no excuse for unreadable text
- [ ] verified in preview.html scrub + stills before any render

Map routes read beautifully hand-drawn: `sketchArrow(x1, y1, x2, y2, {seed: 970+i, rough: 1.4})` instead of straight vector lines — the documentary expedition-map tell.
