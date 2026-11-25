# template/ — project skeleton

This folder is the starting point of every production (copied by `py new-project.py <dir>`, which copies both engine and template).

## Files you edit per project

| File | Role |
|---|---|
| `dialogue.txt` | script in `index\|spk\|text` — index runs 0..N-1; spk: `M`=narrator, other letters=characters (must match `mouthFor` in style.js) |
| `segments.json` | maps `vo/*.wav` voice files to line ranges + tempo/gap settings — must cover all lines in order |
| `srchips.js` | source chips `[first line, last line, label]` — remove all rows if unused |
| `style.js` | **the main file rewritten every project**: CH characters, sc* scenes, SC table, FOOTNOTE_TEXT |

## Files you never edit

- `rig.js` — all machinery: person/cam/helpers/subtitles/chips (for extra props, copy from `examples/jensen-legend/style-v4.js` into style.js)
- `render.mjs` `publish-v4.mjs` `mux-v4.mjs` `mix_studio.py` `measure-subs.mjs` — the engine

## Optional modules (loaded by index.html)

- `atmos.js` — skies, haze, hills, trees, clouds, birds, water, smoke, grain, vignette, caption scrim, label plates. Call them bare from style.js (`skyStops(...)`, `waterBody(...)`, `grainLayer()`)
- `people.js` — `personTH(id, o)` realistic humans with characters defined in `PCH`

Both declare nothing at global scope. Copied code that redeclares their helpers, including `rv` from rig.js, shadows them silently. Details: `docs/guide-cinematic.md` and `docs/guide-scenes.md` §10–11.

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
}
const SC = [[3, scExample], [Infinity, scEnd]];  // first scene covers lines 0–2
```

## Safe zones (1080×1920)

- Top: keep 0–260 px empty (footnote already sits at y≈268) — headings/cards must stay below 260
- Bottom: last subtitle row at y≈1490, max width 840 px with 120 px side margins — nothing important below 1500
- **Key trap:** cam() zoom shifts real positions — `actual = cy + (val − cy) × zoom`; always verify with stills. Details in `docs/guide-scenes.md`

## person() full parameters

`x y scale flip back walk sit t look(-1..1) blink mood mouth pose arms` — see moods/poses in rig.js (face fn / POSE). `walk: true` alternates the legs; `sit: true` hides them
