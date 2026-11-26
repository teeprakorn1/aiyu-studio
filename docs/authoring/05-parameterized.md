# Guide: parameterized rendering — many videos from one project

How to produce multiple video **variants** from a single aiyu-studio project by varying data —
the pattern Remotion calls "parameterized videos", adapted to this pipeline's audio-first
timing backbone. Read [01-scenes.md](01-scenes.md) and [02-dialogue-audio.md](02-dialogue-audio.md) first.

## What can and cannot vary — be honest about this first

The timing backbone (`talk.js`) is generated from **real audio**. That creates a hard split:

| Varies freely per variant | Cannot vary without re-doing audio |
|---|---|
| Chart series, numbers, percentages | Spoken words — any sentence the narrator says |
| Names/labels on cards, chips, headings | The number/order of dialogue lines |
| Colors, palettes, scene dressing | Line timing (it derives from the voice files) |
| Which data-driven cards appear | |
| Footnote text, source chips | |

If your variants need different **narration**, they are not variants — they are separate
productions that happen to share scene code. Scaffold a project per production and copy
`story/style.js` across (the template workflow is built for exactly this). This guide covers
the case where **one audio track** serves many visual variants — recurring formats like
weekly market recaps, sports results, leaderboard updates.

## The pattern: a data module per variant

1. Create `story/data.js` — a classic script exposing one global object:

```js
// story/data.js — the variant's data, nothing else. One object, no logic.
const DATA = {
  title: 'NVDA weekly recap',
  series: [[0, .9], [.2, .7], [.4, .75], [.6, .4], [.8, .25], [1, .05]],
  headline: 'shares +40%',
  chipLabel: 'weekly report · unverified',
  accent: '#76b900',
};
```

2. Load it in **both** `index.html` and `preview.html`, after `story/srchips.js`, before `story/style.js`:

```html
<script src="story/data.js"></script>
<script src="story/style.js"></script>
```

3. Read it in `story/style.js` — never hardcode what varies:

```js
if (o.i >= 4) chartCard(240, 470, 600, 300, DATA.series, DATA.accent, DATA.headline);
pop(DATA.title, 540, 430, '#e05252', Math.min(1, o.p * 2.2), 150);
```

The determinism law is untouched: `DATA` is a constant **within one build** — every frame of
a given render still derives purely from `t`. What changes is the input, exactly like
dialogue.txt changes between productions.

## Batch workflow — swap data, re-render, never overwrite

```bash
# variant A already rendered as v1 — do not touch its outputs
cp variants/week41-data.js story/data.js
npm run stills -- 1,5,10          # QC first — always
npm run publish -- --chunks=4 --out=w41
npm run mux -- --concat=out/w41concat.txt --out=final-w41.mp4

cp variants/week42-data.js story/data.js
npm run stills -- 1,5,10
npm run publish -- --chunks=4 --out=w42
npm run mux -- --concat=out/w42concat.txt --out=final-w42.mp4
```

Rules that keep you safe:

- **Distinct `--out` per variant** — the versioning rule applies to variants exactly as to
  versions: overwriting a finished variant's chunks/final is how work gets lost
- Keep each variant's data file in `variants/` (or anywhere outside `vo/`/`out/`) so the
  batch is reproducible — `story/data.js` itself is just the active copy
- Re-run stills QC per variant — data-driven text has data-dependent width; a longer
  headline can break the safe zone even when the template is correct

## Keeping variants inside safe zones

Variable text is the enemy of fixed layout. Defend at the template level:

- `TXT(txt, x, y, size, color, align, maxW)` — always pass `maxW` for variable strings
- Cards size to their content — check the longest realistic value in stills, not the average one
- Subtitles need no defense (they re-wrap automatically), but they are driven by dialogue.txt — outside the variant system anyway
- If a field can be absent, branch in style.js (`if (DATA.chipLabel) ...`) — never render empty cards

## What this pattern is not

- **Not a render server.** This is a local batch loop over a project folder. If you need
  HTTP-triggered rendering for automation, that is a separate wrapper around the same npm
  scripts — the engine doesn't care what invokes it, but such a server is your own layer,
  not part of the template.
- **Not personalization of speech.** One audio track, many visual variants — never the
  inverse. For per-viewer spoken names you need a TTS loop feeding `npm run mix` per
  variant, which is a real production per variant (see the top of this guide).
