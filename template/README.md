# template/ — project skeleton

This folder is the starting point of every production (copied by `py new-project.py <dir>`, which copies both engine and template).

## Files you edit per project

| File | Role |
|---|---|
| `story/dialogue.txt` | script in `index\|spk\|text` — index runs 0..N-1; spk: `M`=narrator, other letters=characters (must match `mouthFor` in style.js) |
| `story/segments.json` | maps `vo/*.wav` voice files to line ranges + tempo/gap settings — must cover all lines in order |
| `story/srchips.js` | source-chip rows passed to `defineSourceChips()` — remove all rows if unused |
| `story/style.js` | **the main file rewritten every project**: character config, sc* scenes, `defineScenes()` table, `setFootnote()` |

## Files you never edit

- `core/` + `features/` — all machinery: person/cam/helpers/subtitles/chips (for extra props, copy from `examples/legacy/jensen-legend/style-v4.js` in the aiyu-studio repository into `story/style.js`)
- `engine/` — render/publish/mux/mix/measure scripts + shared `lib/` (invoke through the npm scripts in `package.json`)

## Agent skills (`skills/`)

Condensed operational knowledge for coding agents — `skills/aiyu-authoring` (scene writing), `skills/aiyu-pipeline` (production commands/QC), `skills/aiyu-cinematic` (atmosphere/people/maps). Point your agent at them before asking it to touch `story/` — see `skills/README.md`.

## Optional modules (loaded by index.html)

- `features/atmosphere.js` — skies, haze, hills, trees, clouds, birds, water, smoke, grain, vignette, caption scrim, label plates. Call them bare from style.js (`skyStops(...)`, `waterBody(...)`, `grainLayer()`)
- `features/people.js` — `personTH(id, o)` realistic humans; project-specific appearances are registered with `definePeople()` in `story/style.js`
- `features/sketch.js` — hand-drawn annotations: `sketchLine/sketchRect/sketchCircle/sketchArrow/sketchUnderline(x…, {seed, rough, boil, t})` — seed from the shape's ROLE never the frame; details `docs/authoring/01-scenes.md`

Both are IIFE-wrapped and export through `window`/`globalThis`. Copied legacy helper declarations can shadow them inside `story/style.js`, so remove duplicate helpers unless an override is intentional. Details: `docs/authoring/03-cinematic.md` and `docs/authoring/01-scenes.md` §6 + §12.

## Scene cheatsheet (in style.js)

```js
function scExample(o) {
  cam(o, { z0: 1.05, z1: 1.12, cy: 1000, punch: .02, driftX: 5 }, () => {
    // background+characters inside the camera — cam always zooms,
    // real position = cy + (val-cy)*z — beware the safe-zone trap
    person('host', { x: 540, y: 1600, scale: 1, t: o.t, look: 1,
      blink: (o.t % 3.4) < .12,          // blinking
      mood: 'smile',                      // neutral smile worry hurt tense resolute
      mouth: mouthFor('H', o),            // mouth moves only when spk matches
      pose: 'fold',                       // idle fold point open — or arms: [[a,b],[a,b]]
      flip: false, back: false, walk: false, sit: false });
    rim(540, 1600, 1, 1, 'rgba(118,185,0,.4)');
  });
  if (o.i >= 2) TXT('appears from line 2', 540, 400, 60, '#e8dede');
  // rv(o, n) ramps 0→1 during line n and stays 1 after — prefer it over o.lp for anything that must not re-animate
  // rvw(o, n, 'keyword') same but timed to the SPOKEN word — needs word timing (tts-gen/auto-segment/phoneme)
}
defineScenes([[3, scExample], [Infinity, scEnd]]);  // first scene covers lines 0–2
```

## Safe zones (1080×1920)

- Top: keep 0–260 px empty (footnote already sits at y≈268) — headings/cards must stay below 260
- Bottom: last subtitle row at y≈1490, max width 840 px with 120 px side margins — nothing important below 1500
- **Key trap:** cam() zoom shifts real positions — `actual = cy + (val − cy) × zoom`; always verify with stills. Details in `docs/authoring/01-scenes.md`

## person() full parameters

`x y scale flip back walk sit t look(-1..1) blink mood mouth pose arms` — see moods/poses in the runtime (face fn / POSE). `walk: true` alternates the legs; `sit: true` hides them
