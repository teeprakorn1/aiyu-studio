# Guide: cinematic scenes — realistic humans, layered backgrounds, frame treatments

How the `thai-origins` production achieved its cinematic look, and how to use the two
modules extracted from it: `atmos.js` (atmosphere & nature) and `people.js` (realistic
humans). Both load automatically in template projects — see `examples/thai-origins/` for
the original production code.

## 1. Choosing your character renderer

| | `person()` (rig.js) | `personTH()` (people.js) |
|---|---|---|
| Proportions | 3 heads tall — mascot | ~5.5 heads tall — realistic |
| Face | big googly eyes | tapered head, almond eyes, visible neck, ears, hair styles |
| Limbs | capsules, no joints | two segments with visible knees/elbows |
| Walk | simple bob | true alternating stride with lift, bob, arm counter-swing, forward lean |
| Best for | presenter/news formats (jensen-legend) | historical/cinematic stories (thai-origins) |

They can mix in one film — mascot for a host, realistic for story characters.

Both modules load automatically in template projects (see [guide-scenes.md §10–11](guide-scenes.md) for the global-name rules when copying code).

## 2. personTH anatomy

```js
personTH('merchant', { x: 540, y: 1560, scale: 1, t: o.t,
  walk: true,       // boolean — stride position comes from (t*walkSpeed+phase)%1
  walkSpeed: 1.6,   // strides per second-ish (1.2 = amble, 1.6 = walk, 2+ = brisk)
  look: 1,          // -1..1 pupil shift + slight head offset
  flip: false,      // mirror horizontally
  blink: (o.t % 3.4) < .12,
  mood: 'neutral',  // neutral | worry
  mouth: .5,        // 0..1 open amount — feed mouthFor() if the character speaks
  phase: 0,         // desync offset when several people walk together
});
```

Local coordinate system: feet baseline at `y`, up is negative. Total height ~520 local
units before scale.

Key measurements (useful when compositing):

| Feature | Local Y | Notes |
|---|---|---|
| feet | 0 | baseline, contact shadow ellipse at y+8 |
| knees | ~−120 | two-segment legs: hip(±22,−216) → knee → foot |
| waist hem | −96 | (−40 for robes, which cover the thigh — only shin drawn) |
| shoulders | ~−342 | torso is a curved bezier mass, narrower at waist |
| neck | −380..−352 | separate shaded trapezoid — a visible neck matters |
| head center | −436 | tapered: wide at cheeks (±54), narrow chin |

### Characters are configuration, not code

`PCH` defines appearance per role — add your own entries instead of branching draw code:

```js
const PCH = {
  merchant: { skin:'#B97B50', skinShade:'#9A6340', hair:'#211B18',
              cloth:'#8F3F34', sash:'#D6A03D', hairStyle:'topknot', fillet:true },
  monk:     { ..., hairStyle:'shaved', robe:true },
  ...
};
```

`skinShade` is used for the neck and shadowed areas; `sash` draws a diagonal shoulder
cloth; `robe` switches the torso/waistcloth logic; `fillet` is a gold headband;
`hairStyle` is `topknot` / `shaved` / `none`.

### The walk cycle — read this before animating

```js
const w = ((t * rate + phase) % 1) * Math.PI * 2;   // 0..2π stride phase
swingL =  sin(w) * 30;   swingR = -sin(w) * 30;     // legs oppose
liftL  = max(0, cos(w)) * 16;                       // foot lifts on its forward swing
bob    = -|sin(w)| * 7;                             // body dips twice per stride
armL/R = ∓sin(w) * .3;                              // arms counter-swing opposite legs
```

- Legs genuinely **alternate** — opposite signs on the same sine
- **Phase .25 is maximum leg spread** mid-stride — to freeze that pose in a still use
  `walk: true` with `(t*walkSpeed + phase) % 1 ≈ .25` (at t=0 simply `phase: .25`)
- When several people walk together, stagger `phase` (0, .5, ...) or they march in
  unnerving unison
- Idle (no walk) falls back to a gentle breathing sway — never leave a character frozen

### Detail scaling

Faces render only when `scale >= .42` (and not `noFace`) — background figures skip the
expensive face path. Combined with the color-mixing rule below, distant walkers stay
cheap and correct.

## 3. The layered background recipe

Every cinematic scene in the production stacks the same depth order. Example from the
merchant/canal scene (see `scMerchant` in the example for the full annotated version):

```js
cam(o, { z0: 1.03, z1: 1.09, cy: 980, punch: .014, driftX: 4 }, () => {
  skyStops([[0,DUSK.sky0],[.42,DUSK.sky1],[.68,DUSK.sky2],[.82,DUSK.sky3]], 0, 1240);
  cloudsDusk([[230,420,320],[780,540,380],[430,690,250]], o.t);   // sky life
  birdsFlock(520, 540, 5, o.t, 11);
  focusGlow(700, 1010, 420, '255,180,100', .3);                   // low sun: glow first
  CIRC(700, 1010, 46, '#FFD9A0', 0);                              //   then the disc
  hazeBand(950, 260, '217,145,84', .22);                          // warm horizon band
  hillsLayer(1162, 130, 3, mixHex('#2A1E16', DUSK.sky2, .72));    // FAR hills: 72% sky color
  hillsLayer(1176,  78, 7, mixHex('#20160F', DUSK.sky2, .5));     // NEAR hills: 50% sky color
  // far silhouettes (stupas, prangs, palms) at 55% sky mix
  // midground props at 25% sky mix
  hazeBand(1080, 180, '217,145,84', .16);                         // second haze in front of far layer!
  // embankment, treeMass clusters, stilt houses, smoke, small walkers
  waterBody(1244, DUSK.water0, DUSK.water1);                      // water line
  lightReflection(700, 1244, '255,180,100', o.t, .2);             // sun path on water
  ripples(1256, 1620, o.t, 5);
  // foreground characters
  captionScrim(.5);   // then subtitles draw above
});
// outside cam:
screenVig(.3); grainLayer();
```

### Rule 1: depth comes from color mixing, never alpha

```js
const farC = mixHex('#1A120C', DUSK.sky2, .55);   // silhouette 55% toward sky color
```

Distant objects are drawn **opaque** in a color pre-mixed toward the horizon/sky color —
that is what atmosphere does in reality. Alpha-faded silhouettes read as translucent
ghosts and layering shows through. Objects behind haze: increase the mix ratio, never
decrease the alpha. Background humans too: small walkers are drawn opaque, color-mixed
(at small scale, in dusk light, the difference in skin tone vanishes into the mix).

### Rule 2: the horizon is a band, not a line

Nothing sits directly on the sky/land boundary. The recipe: hills overlap the boundary,
then a `hazeBand` at the junction **in front of** the far layer softens it, then
midground elements overlap the hills. A hard horizontal line anywhere in a frame reads
as a mistake.

### Rule 3: every layer moves at its own speed

Clouds drift slowly (`sin(t*.05)`), birds flap fast (`sin(t*6)`), smoke rises, water
flickers, motes float. Even at subtle amplitudes this is what separates "living painting"
from "slide". All motion is `o.t`-driven sine — cheap, deterministic, seamless.

### Rule 4: clouds must be wide flat overlapping strips

Round shaded discs read as UFOs — discovered the hard way in production. `cloudsDusk`
draws 6 overlapping flat ellipses (rx ≈ 5× ry) spread across a wide span per cloud,
low alpha, no bright rims.

## 4. The water system

Three independent pieces — compose them:

1. **`waterBody(y0, c0, c1)`** — vertical gradient base. The waterline y is where your
   scene's horizontal layout flips from land/embankment to water
2. **`ripples(y0, y1, t, seed)`** — rows of short curved broken strokes; length, width
   and alpha all increase with depth (toward the viewer). Slow lateral sine drift +
   independent alpha pulsing per ripple. Never draw continuous lines — broken strokes
   read as water, continuous lines read as wire
3. **`lightReflection(x, y0, col, t, strength)`** — flickering vertical dashed column of
   light under every light source: the sun, lit windows, boat lanterns. Additive blend,
   wobble increasing with depth. **A scene with lit windows but no reflections looks
   wrong even if viewers can't say why** — reflections are not optional

## 5. Frame treatments — always last, fixed order

```js
captionScrim(.5);   // inside the scene, BELOW where subtitles draw
// ... cam() closes ...
screenVig(.3);      // OUTSIDE cam — vignette is a lens effect, must not drift with camera
grainLayer();       // film grain over everything, alpha .035, 'overlay' composite
```

- `grainLayer` builds its noise tile **once** in an offscreen canvas — never regenerate
  noise per frame (expensive, and it would shimmer)
- vignette center is slightly above middle (`fy: .52` default pulls focus to subject height)
- these three alone carry about half of the perceived "cinematic" quality — do not skip them

## 6. Deterministic randomness — the hard rule

```js
const srnd = i => { const x = Math.sin(i*127.1+311.7)*43758.5453; return x - Math.floor(x); };
```

**Never `Math.random()` in scene code.** Two reasons:

1. Flicker — randomness re-rolls every frame, so tree positions/ripple offsets/jitter
   would swim and boil
2. Chunk-parallel rendering — publish renders disjoint timeline segments in separate
   processes; frames must be a pure function of `t`. Any hidden state breaks the seams

Every helper in atmos.js/people.js takes `seed` parameters — vary them per element
(`treeMass(..., 5)`, `treeMass(..., 6)`) so repeated elements differ, but deterministically.

## 7. Palettes as named systems

The production used three named palettes — define yours once at the top of style.js:

```js
const DUSK  = { sky0:'#151B2F', sky1:'#342D45', sky2:'#87513C', sky3:'#D99154',
                water0:'#243846', water1:'#0B1720' };
const NIGHT = { sky0:'#071C2B', ... fire:'#FFB84D', ivory:'#E8F0DF' };
const PARCH = { paper:'#D6C39A', land:'#B78A55', ink:'#3B2A1D', cinnabar:'#B84430', ... };
```

Colors never appear raw in scene code — always through a palette key or a `mixHex` of
one. This is what keeps 7 scenes looking like one film, and lets you re-grade the whole
video by editing a few hex values.

## 8. Period props library (in the example, copy freely)

`examples/thai-origins/style.js` contains reusable props — copy any of them into your
project's style.js: `stupaDV` (Dvaravati stupa), `prangKH` (Khmer prang), `palmTree`,
`stiltHouse` (4 variants, optional warm lit window — remember the water reflection!),
`longboat`, `junkShip` (sail battened junk), `dharmProp` (dharmachakra), `chediEle2`
(elephant-buttressed chedi), plus the parchmentInset card. All take `(x, y, scale)`
in the same local convention as people.js and accept pre-mixed colors for depth placement.

Prop placement lesson: raised foreground props must respect the subtitle zone — the
junk ship originally sat low enough that its sail hid behind captions; stilt houses need
visible stilts into the water or they float.

## 9. Thumbnails — paint them, don't capture them

Production learning: frame captures with text overlaid looked uninteresting as
thumbnails. What worked (`examples/thai-origins/thumb.html`):

- **A bespoke painted scene** in the film's own visual language — load `people.js` and
  draw a large character as the focal point, mid-stride (walk phase .25)
- **Typography that performs the hook**: the myth text with a hand-drawn red X stroked
  over the key word only ("คนไทยมาจาก~~จีน~~"), then the payoff in gold below —
  size the X strokes in explicit pixels; relative sizing scaled it into an unreadable blob
- **Never leave dead space** — the bottom half initially sat empty black; a warm ground
  gradient + grass strokes + horizon silhouettes fixed it
- Render headless at exact platform sizes (1280×720, 1080×1920): open `thumb.html`
  in playwright at that viewport and screenshot the canvas. The thai-origins
  thumbnails were made this way; the example ships `thumb.html` only, not the script
  that captured it.

Using the film's own renderer for the thumbnail also guarantees thumbnail-content match,
which measurably affects retention.

## 10. The master checklist for a cinematic scene

1. Multi-stop sky gradient, never a flat fill
2. Something moving in the sky (clouds, birds, stars)
3. ≥2 depth layers of landforms, color-mixed — horizon never a hard line
4. Haze bands at depth junctions
5. Water = body + ripples + reflections of every light source
6. Vegetation masses filling gaps between man-made structures
7. Smoke/motes/fireflies for air
8. Characters walking with staggered phases; idle characters breathing
9. captionScrim inside, screenVig + grainLayer outside cam, in that order
10. Verify with stills at several times — t=0 hides animation-phase bugs
