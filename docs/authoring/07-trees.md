# Guide: tidy tree diagrams

`features/tree.js` draws node-link tree diagrams — dynasty and succession trees,
migration forks, product families, org lineages. The layout is the Reingold-Tilford
"tidy tree" algorithm: parents centred over children, no overlapping nodes, mirror
symmetry preserved. Technique adapted from [d3-hierarchy](https://github.com/d3/d3-hierarchy)
(ISC) — reimplemented from the published Buchheim et al. algorithm; see
[../acknowledgements.md](../acknowledgements.md).

Vertical video reality check first: trees that read well in 1080×1920 short-form have
**roughly 5–15 nodes and 2–4 levels**. Wider or deeper than that and the text shrinks
past readability — tell the big genealogy in chapters instead, one branch per scene.

## 1. Data is plain nested objects

```js
const DYNASTY = {
  name: 'ออกญาศรีธรรมาธิราช', sub: '1320–1355', children: [
    { name: 'เจ้าโปรย', sub: '1355–1381', children: [
      { name: 'เจ้าเมือง', sub: '1381–1402' },
    ] },
    { name: 'เจ้าจีน', sub: '1358–1377' },
  ],
};
```

- `name` — required string, rendered as the plate's main label
- `sub` — optional second line in a smaller, dimmer style (reign years, roles, dates)
- `children` — optional array of the same shape; sibling order is preserved left-to-right

## 2. One call draws the whole diagram

```js
treeDiagram({ data: DYNASTY, x0: 90, x1: 990, y0: 430, y1: 1360 }, rv(o, 4), { line: '#c8a24a' });
```

| spec field | meaning |
|---|---|
| `data` | the nested tree object |
| `x0`, `x1` | horizontal layout bounds in px — node centres stay inside |
| `y0`, `y1` | vertical bounds — depth 0 (root) sits at `y0`, the deepest row at `y1` |

The second argument is **reveal progress 0..1** — drive it with `rv(o, n)` or `rvw()`
so the tree grows as the narration introduces it. Within each node's slot the parent
link draws first, then the plate pops in with a spring; reveal order is depth-first,
left-to-right, so parents always appear before their children.

Useful opts (all optional):

| opt | default | meaning |
|---|---|---|
| `line` | `'#8a7a5a'` | connector + plate outline colour |
| `plate` | `'rgba(14,16,22,.92)'` | plate fill |
| `text` / `sub` | `'#e8dede'` / `'#9a8f7a'` | label colours |
| `maxW` | `260` | plate width cap in px |
| `h` | `76` | plate height in px |
| `size` | `30` | base font size in px — `fitTXT` shrinks it to fit |

Plate width is automatic: the layout measures the tightest same-depth spacing and
sizes plates so **neighbours can never overlap** — wide trees simply get narrower
plates (and smaller text, hence the node-count guidance above).

## 3. Custom drawing with treeLayout

When the default plates are not what the scene needs — portraits in nodes, flags,
branch colours per lineage — take the layout and draw yourself:

```js
const { nodes, links, unitPx } = treeLayout(DYNASTY, { x0: 90, x1: 990, y0: 430, y1: 1360 });
// nodes: [{x, y, depth, data, order}] sorted by (depth, x) — order is the reveal index
// links: [{a, b}] parent→child pairs referencing the same node objects
```

`unitPx` is the size of one separation unit in px — plates up to ~0.9×unitPx wide are
guaranteed not to collide at the same depth. The layout is a pure function of the data
(exact IEEE arithmetic only, no trigonometry), so calling it per frame is safe for
determinism — and cheap: microseconds for documentary-scale trees.

## 4. Compositing notes

- Draw the tree **inside** `cam()` when it should drift and zoom with the scene.
- Depth rows spread evenly between `y0` and `y1` — compress the region for shallow
  trees (2 levels in a 900px-tall region reads sparse), stretch it for deep ones.
- Connectors are cubic beziers with vertical tangents — the classic genealogy-chart
  curve. They are part of the reveal; nothing extra to draw.
- Keep the root meaningfully small in scope: if the narrator says "three branches",
  the tree should show three branches — the diagram is a visual sentence, not a database.

## 5. Determinism notes

- No randomness anywhere in the module — layout is exact arithmetic, reveal is a pure
  function of `p`. Same `p`, same frame, every parallel chunk.
- Do not mutate the data object between frames; treat it as a constant like any scene spec.
- Reveal timing must come from `rv`/`rvw` (line indices), never from seconds — re-timed
  narration re-times the tree automatically.
