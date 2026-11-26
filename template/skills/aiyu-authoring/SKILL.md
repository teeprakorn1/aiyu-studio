---
name: aiyu-authoring
description: Write and edit scenes in an aiyu-studio project — story/style.js, the layer law, registry API, safe zones, cam() trap, motion curves, speaker-aware lip sync. Use when creating or modifying scenes, characters, cards, or any visual code in story/.
---

# aiyu-authoring — writing scenes for aiyu-studio

You are editing **story/** files only. `core/` and `features/` are the runtime — never edit them; missing shared primitives are a reason to stop and tell the user, never a reason to patch the runtime inside a project.

## When this skill applies

| Trigger | Action |
|---|---|
| Writing a new scene or editing `story/style.js` | Read this whole skill first |
| Any visual element "doesn't look right" | Check the cam() trap + safe zones sections before touching coordinates |
| Copying scene code from another project or an example | Read the collision warning in `aiyu-cinematic` / docs §12 pattern — rename or IIFE-wrap |
| Asked to change engine/, core/, or features/ inside a project | 🛑 STOP — tell the user this violates the template law; changes belong upstream |

## ❌/✅ the four fatal patterns

| ❌ WRONG — breaks the film | ✅ CORRECT |
|---|---|
| `Math.random() * 40` for scatter positions | `srnd(7)` seeded once per element family — same seed every frame |
| `if (o.lp > .5)` to reveal an element | `rv(o, n)` — lp re-triggers the animation on every later line |
| hand-editing `talk.js` numbers to fix timing | fix the input (`segments.json`/dialogue) and re-run `npm run mix` |
| patching `features/cards.js` because a card is almost-right | compose what you need in `story/style.js` from primitives |

> 🔴 **Self-check before writing any scene code:** Does anything in what I'm about to write use `Math.random`, `Date.now`, or read time from anywhere except `o.t`/`o.p`/`o.lp`/`rv()`? If yes → STOP, rewrite as a pure function.

## The two laws that break everything if violated

1. **Determinism** — every visual must be a pure function of time `t` (or progress `p`/`lp`). Never `Math.random()` or `Date.now()` — use `srnd(seed)` from core. Violations corrupt parallel chunk rendering silently.
2. **talk.js is the only timing truth** — scenes, mouths, subtitles all derive from `TALK`. Never invent a second timing source, never hand-edit talk.js. Re-time the film by re-running `npm run mix` (or `npm run stub`), never by patching numbers.

## File anatomy — story/style.js

Configuration is explicit registration at the bottom of the file:

```js
const CH = { host: { skin: '#d9a06e', hair: '#7d8087', top: '#1c1c20', hs: 'jensen', jacket: true } };
function scOpening(o) { /* ... */ }
const SC = [[3, scOpening], [8, scTalk], [Infinity, scClosing]];
defineCharacters(CH);
defineScenes(SC);
setFootnote('My story · simulated visuals');
```

- `SC` rows are `[first line of the NEXT scene, sceneFn]` — sorted ascending, **must end with `Infinity`**. `[[3, scOpening]]` means scOpening covers lines 0–2.
- `defineSourceChips([[firstLine, lastLine, label], ...])` lives in `story/srchips.js` — max 2 rows visible, delete all rows if the story has no citations.
- Legacy bare `CH`/`SC`/`FOOTNOTE_TEXT` globals still work as a fallback, but always write the registration calls in new code.

## The `o` object every scene receives

| field | meaning |
|---|---|
| `o.t` | current time in seconds |
| `o.p` | scene progress 0..1 — drives camera zoom |
| `o.i` | current dialogue line index — progressive reveals: `if (o.i >= 4)` |
| `o.lp` | progress within the current line 0..1 |
| `o.line` | current line object (`spk`, `txt`) |

## cam() — the camera trap you must understand

```js
cam(o, { z0: 1.05, z1: 1.13, cy: 1060, punch: .018, driftX: 5 }, () => {
  // background + characters ONLY
});
// cards/text/pop-ins go OUTSIDE cam()
```

Everything inside the callback is zoomed/panned; overlays outside stay fixed. **Because cam zooms, on-screen positions shift** — a heading placed at y=300 in a static frame is not at y=300 in the render. This is why you verify with `preview.html` and stills instead of trusting coordinates.

## Safe zones (vertical 1080×1920 for Reels/TikTok)

- **Nothing above y=260** — platform UI covers it
- **Nothing below y≈1490 except subtitles** — caption/UI overlays cover it
- Characters stand around y=1500–1700 (they extend below the safe zone deliberately — feet cropping is fine)
- Left/right margins ≈ 60 px

## Speaker-aware lip sync — the contract

`spk` in dialogue.txt is a single character (`M`, `J`, …). Mouths move only when you wire them:

```js
person('host', { x: 320, y: 1560, scale: 1, t: o.t, mouth: mouthFor('M', o) });
```

If `mouthFor('M', o)` doesn't match the `spk` used in dialogue.txt, that character stays silent-faced forever. One spk = one character.

## Motion curves — use the right one for the property

| curve | behavior | use for |
|---|---|---|
| `ease(p)` | cubic out, never overshoots | **alpha always** (overshoot = invisible/garbage alpha) |
| `easeInOut(p)` | symmetric gentle | camera, continuous motion |
| `easeBack(p)` | overshoots ~1.1 | snappy pop-ins |
| `easeElastic(p)` | rubber wobble | rare playful beats |
| `springy(p, stiffness=170, damping=12)` | exact damped spring, ~20% overshoot | scale/position of anything physical |
| `rv(o, n, r=1.7)` | line-scoped reveal progress 0→1 during line n, stays 1 after | any element appearing at a line — **never feed raw `o.lp`** or it re-animates every line |

Cards (`nameCard`/`newsCard`/`emailCard`/`quoteCard`/`chartCard`) and `pop()` already use `springy` internally — you get the bounce free.

## Runtime API quick reference (all global)

- **Primitives**: `RRECT(x,y,w,h,r,fill)` · `TXT(txt,x,y,size,color,align,maxW)` · `LINE/CIRC/LIMB/PATH/SHAPE` · `g` (the ctx) · `W=1080 H=1920` · `srnd(seed)` · `mixHex/hexA` · `clamp01/lerp`
- **Environment**: `wall(floor,ceiling)` `floorY(y,color)` `city()` `stars(n)` `rain(alpha,spd)` `glow(x,y,r,rgb,a)` `rim()` `vig()` `tint(rgb,a)` `lamp` `win` `circuitField`
- **Character (chibi)**: `person(id, opts)` — opts: x y scale t flip look blink mood mouth back young ghost bw glasses lashes earring; `hs` hairstyles: `jensen|swoop|bob|blonde|longF|pony|none`; clothing flags in CH: `jacket/suit/tie/blazer/dress/floral`
- **Cards**: `pop(txt,x,y,color,p,maxW)` `chip(txt,x,y)` `quoteCard(lines,p,x?)` `chartCard(x,y,w,h,series,color,label)`

## Battle-tested scene patterns

1. **Cold open** — back-turned figure (`back: true`) + rain/night + big red `pop()` hook text
2. **Dialogue** — two persons facing each other (`flip: true` on the right one), reveal cards line by line with `if (o.i >= n)`
3. **Closing** — front-facing resolute character, large text fading in with `ease(o.p * 1.3)` on alpha
4. Blink naturally: `blink: (o.t % 3.4) < .12` — different modulo per character

## Verify before rendering

Open `preview.html` and scrub — catches layout/safe-zone/lip-sync problems in seconds. `npm run stills -- 1,5,10` for a static check before any real render. Never discover layout bugs after a 20-minute publish.

## 🔴 Self-check before saying a scene is done

| Check | Question |
|---|---|
| Determinism | No `Math.random`/`Date.now`/external state anywhere in the scene? |
| Timing | Everything derives from `o` fields/`rv()` — no invented timers? |
| Safe zone | Nothing above y=260, nothing important below y≈1490? |
| Lip sync | Every speaking character has `mouth: mouthFor('<spk>', o)` matching dialogue.txt? |
| Camera | Cards/text outside `cam()`, background+characters inside? |
| Preview | Actually scrubbed the scene in preview.html — not just "should be fine"? |

> ❌ Declaring done without previewing = the scene is not done. ✅ Scrub first, then stills, then render.
