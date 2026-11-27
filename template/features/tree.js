/**
 * features/tree.js — tidy tree diagrams (optional module)
 * ------------------------------------------------------------------
 * Node-link tree diagrams for lineage, succession, branching and composition stories:
 * dynasty trees, migration forks, product families. The layout is the Reingold-Tilford
 * "tidy tree" algorithm as improved by Buchheim, Junger & Leipert (2002) — overlap-free,
 * symmetry-preserving, centred parents — reimplemented from the published algorithm;
 * the d3-hierarchy implementation (ISC) was reviewed as the reference. No code copied.
 * See docs/acknowledgements.md.
 *
 * LOAD ORDER: after core/ runtime files, before story/style.js — it uses core globals
 * (g, RRECT, TXT, fitTXT, ease, springy).
 *
 * Everything is deterministic: the layout is a pure function of the input data using only
 * exact IEEE arithmetic (no trigonometry), and the reveal is a pure function of progress p —
 * drive it with rv(o, n), never with seconds directly.
 *
 * QUICK RECIPE
 * ------------
 *   const FAMILY = { name: 'ออกญา', children: [
 *     { name: 'โปรย', sub: '1380–1412', children: [{ name: 'เจ้าเมือง' }] },
 *     { name: 'จีน', sub: '1384–1409' },
 *   ]};
 *   treeDiagram({ data: FAMILY, x0: 90, x1: 990, y0: 420, y1: 1380 }, rv(o, 4), {});
 *
 * Node plates auto-size to the layout so same-depth nodes never overlap; text shrinks
 * to fit via fitTXT. For custom drawing use treeLayout(data, region) and draw yourself.
 */

// NOTE: like atmosphere.js and globe.js this module is fully IIFE-wrapped; nothing is
// declared at global lexical scope. treeLayout is exported for unit tests and custom
// drawing — the author-facing default visual is treeDiagram.

(() => {

// ── Reingold-Tilford tidy layout (Buchheim et al. 2002) ─────────────
// Internal wrapper nodes carry: z prelim x, m mod, c change, s shift, t thread,
// a ancestor, i index among siblings. Positions are in abstract "separation units"
// first, then normalized into the target region — the same two-phase structure the
// algorithm has always had. Default separation: 1 between siblings, 2 between cousins —
// wider cousin spacing is what visually groups branches.

const SEP = (a, b) => a.parent === b.parent ? 1 : 2;

function wrapTree(data) {
  const build = (d, parent, i, depth) => {
    const w = { data, d, parent, i, depth, children: null, z: 0, m: 0, c: 0, s: 0, t: null, a: null };
    w.a = w; // default ancestor is self — the contour walk depends on it
    const kids = Array.isArray(d.children) ? d.children.filter(k => k && typeof k === 'object' && typeof k.name === 'string') : [];
    if (kids.length) w.children = kids.map((k, j) => build(k, w, j, depth + 1));
    return w;
  };
  const root = build(data, null, 0, 0);
  // dummy parent above the root — the algorithm wants one for the second walk
  root.parent = { children: [root], z: 0, m: 0, c: 0, s: 0, t: null, a: null, depth: -1 };
  return root;
}

// contour walkers — follow children or jump along threads
const leftmost = v => v.children ? v.children[0] : v.t;
const rightmost = v => v.children ? v.children[v.children.length - 1] : v.t;

function executeShifts(v) {
  let shift = 0, change = 0;
  for (let i = v.children.length - 1; i >= 0; i--) {
    const w = v.children[i];
    w.z += shift; w.m += shift;
    shift += w.s + (change += w.c);
  }
}

function moveSubtree(wm, wp, shift) {
  const change = shift / (wp.i - wm.i);
  wp.c -= change; wp.s += shift; wm.c += change;
  wp.z += shift; wp.m += shift;
}

function nextAncestor(vim, v, ancestor) {
  return vim.a.parent === v.parent ? vim.a : ancestor;
}

// core contour reconciliation — when the right subtree's left edge collides with the
// previous subtrees' right edge, push the new subtree right and record the shift
function apportion(v, w, ancestor) {
  if (!w) return ancestor;
  let vip = v, vop = v, vim = w;
  let vom = vip.parent.children[0];
  let sip = vip.m, sop = vop.m, sim = vim.m, som = vom.m;
  for (; ;) {
    vim = rightmost(vim); vip = leftmost(vip);
    if (!vim || !vip) break;
    vom = leftmost(vom); vop = rightmost(vop);
    vop.a = v;
    const shift = vim.z + sim - vip.z - sip + SEP(vim, vip);
    if (shift > 0) {
      moveSubtree(nextAncestor(vim, v, ancestor), v, shift);
      sip += shift; sop += shift;
    }
    sim += vim.m; sip += vip.m; som += vom.m; sop += vop.m;
  }
  if (vim && !rightmost(vop)) {
    vop.t = vim;
    vop.m += sim - sop;
  }
  if (vip && !leftmost(vom)) {
    vom.t = vip;
    vom.m += sip - som;
    ancestor = v;
  }
  return ancestor;
}

function firstWalk(v) {
  const siblings = v.parent.children;
  const w = v.i ? siblings[v.i - 1] : null;
  if (v.children) {
    for (const c of v.children) firstWalk(c);
    executeShifts(v);
    const midpoint = (v.children[0].z + v.children[v.children.length - 1].z) / 2;
    if (w) {
      v.z = w.z + SEP(v, w);
      v.m = v.z - midpoint;
    } else {
      v.z = midpoint;
    }
  } else if (w) {
    v.z = w.z + SEP(v, w);
  }
  v.parent.A = apportion(v, w, v.parent.A || siblings[0]);
}

function secondWalk(v, modSum, out) {
  v.x = v.z + modSum;
  out.push(v);
  if (v.children) for (const c of v.children) secondWalk(c, modSum + v.m, out);
}

/**
 * Lay out a tree in a pixel region — pure function, exact arithmetic only, no trigonometry.
 * Positions are node CENTRES. Rows share y per depth; parents are centred over their children;
 * same-depth nodes are at least one separation unit apart (use unitPx to size node plates).
 * @param {object} data - nested {name: string, sub?: string, children?: [...]}
 * @param {object} region - {x0, x1, y0, y1} layout bounds in px
 * @returns {{nodes: Array, links: Array, unitPx: number, maxDepth: number}} nodes sorted by
 *   (depth, x) with {x, y, depth, data, order}; links as {a, b} parent→child node pairs
 */
function treeLayout(data, region) {
  if (!data || typeof data !== 'object' || typeof data.name !== 'string') {
    throw new TypeError('treeLayout data must be an object with a string name');
  }
  if (!region || !(region.x1 > region.x0) || !(region.y1 > region.y0)) {
    throw new TypeError('treeLayout region must have x1 > x0 and y1 > y0 in px');
  }
  const root = wrapTree(data);
  firstWalk(root);
  root.parent.m = -root.z;
  const flat = [];
  secondWalk(root, root.parent.m, flat);

  // normalize abstract units into [x0, x1] with half-separation padding at the edges
  let left = flat[0], right = flat[0], maxDepth = 0;
  for (const v of flat) {
    if (v.x < left.x) left = v;
    if (v.x > right.x) right = v;
    if (v.depth > maxDepth) maxDepth = v.depth;
  }
  const pad = left === right ? 1 : SEP(left, right) / 2;
  const tx = pad - left.x;
  const span = right.x + pad + tx;
  const unitPx = (region.x1 - region.x0) / span;
  const dy = (region.y1 - region.y0) / Math.max(1, maxDepth);

  const nodes = flat.map(v => ({
    x: region.x0 + (v.x + tx) * unitPx,
    y: region.y0 + v.depth * dy,
    depth: v.depth,
    data: v.d,
    _w: v,
  }));
  nodes.sort((p, q) => p.depth - q.depth || p.x - q.x);
  nodes.forEach((n, i) => { n.order = i; });
  const byWrap = new Map(nodes.map(n => [n._w, n]));
  const links = [];
  for (const n of nodes) {
    if (n._w.children) for (const c of n._w.children) links.push({ a: n, b: byWrap.get(c) });
  }
  for (const n of nodes) delete n._w;
  return { nodes, links, unitPx, maxDepth };
}

// ── Drawing ───────────────────────────────────────────────

const LINK_SEG = 24;

/**
 * Tidy tree diagram with progressive depth-first reveal. p is reveal progress 0..1 —
 * drive with rv(o, n) or rvw(). Within each node's window the parent link draws first,
 * then the plate pops in with a spring. Node plates auto-fit the layout spacing; text
 * shrinks via fitTXT. Everything is a pure function of p — same p, same frame, every chunk.
 * @param {object} spec - {data, x0, x1, y0, y1} — data as in treeLayout, region in px
 * @param {number} p - reveal progress 0..1
 * @param {object} [opts] - {plate '#rrggbb'|rgba, text, sub, line, maxW px cap, h px plate height,
 *   size px base font, pad px text inset}
 * @returns {void}
 */
function treeDiagram(spec, p, opts = {}) {
  const prog = Math.max(0, Math.min(1, p));
  if (prog <= 0) return;
  const { nodes, links, unitPx } = treeLayout(spec.data, spec);
  const n = nodes.length;
  const nodeW = Math.max(60, Math.min(unitPx * 0.92, opts.maxW || 260));
  const nodeH = opts.h || 76;
  const plateCol = opts.plate || 'rgba(14,16,22,.92)';
  const textCol = opts.text || '#e8dede';
  const subCol = opts.sub || '#9a8f7a';
  const lineCol = opts.line || '#8a7a5a';
  const fontSize = opts.size || 30;
  const inset = opts.pad === undefined ? 14 : opts.pad;
  const slot = 1 / n;

  const byOrder = [...nodes].sort((a, b) => a.order - b.order);
  for (const node of byOrder) {
    const local = (prog - node.order * slot) / slot;
    if (local <= 0) continue;

    // link first: parent bottom edge → child top edge, cubic with vertical tangents
    const link = links.find(l => l.b === node);
    if (link) {
      const lp = Math.min(1, Math.max(0, (local - 0.05) / 0.45));
      if (lp > 0) {
        const x1 = link.a.x, y1 = link.a.y + nodeH / 2;
        const x2 = link.b.x, y2 = link.b.y - nodeH / 2;
        const my = (y1 + y2) / 2;
        g.strokeStyle = lineCol;
        g.lineWidth = 3;
        g.lineCap = 'round';
        const upto = Math.max(1, Math.ceil(lp * LINK_SEG));
        g.beginPath();
        for (let i = 0; i <= upto; i++) {
          const u = Math.min(lp, i / LINK_SEG);
          const w0 = (1 - u) * (1 - u) * (1 - u), w1 = 3 * (1 - u) * (1 - u) * u, w2 = 3 * (1 - u) * u * u, w3 = u * u * u;
          const px = w0 * x1 + w1 * x1 + w2 * x2 + w3 * x2;
          const py = w0 * y1 + w1 * my + w2 * my + w3 * y2;
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.stroke();
      }
    }

    // plate pop — springy scale about the node centre
    const np = Math.min(1, Math.max(0, (local - 0.35) / 0.65));
    if (np <= 0) continue;
    const sc = springy(np, 240, 14);
    if (sc <= 0.01) continue;
    const alpha = Math.min(1, np * 3);
    g.save();
    g.translate(node.x, node.y);
    g.scale(sc, sc);
    g.globalAlpha = alpha;
    const w = nodeW, h = nodeH;
    RRECT(-w / 2, -h / 2, w, h, 12, plateCol);
    g.lineWidth = 2;
    g.strokeStyle = lineCol;
    g.stroke();
    const hasSub = typeof node.data.sub === 'string' && node.data.sub;
    fitTXT(node.data.name, 0, hasSub ? -2 : 9, w - inset * 2, fontSize, textCol, 'center', 700);
    if (hasSub) fitTXT(node.data.sub, 0, h / 2 - 12, w - inset * 2, fontSize - 8, subCol, 'center', 400);
    g.restore();
  }
}

Object.assign(globalThis, { treeLayout, treeDiagram });
})();
