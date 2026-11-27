/**
 * @file tests/unit/tree.test.mjs — tree diagram: Reingold-Tilford layout invariants, reveal choreography, determinism.
 * The drawing function is exercised against a recording stub context; the layout carries the logic.
 * Run: node --test tests/unit/tree.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../helpers/load-script.mjs';

// recording canvas stub — base.js captures the context at load time, so document must be
// stubbed before loadScripts (the base-fit.test.mjs pattern)
const ops = [];
const texts = [];
const stubCtx = new Proxy({}, {
  get: (t, k) => {
    if (k === 'measureText') return () => ({ width: 40 });
    if (k === 'fillText') return (txt) => { ops.push('fillText'); texts.push(txt); };
    if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop: () => {} });
    if (typeof k === 'string') return (...a) => ops.push(k);
    return undefined;
  },
  set: () => true,
});
globalThis.document = { getElementById: () => ({ getContext: () => stubCtx }) };
const env = loadScripts(['core/base.js', 'core/motion.js', 'features/tree.js'],
  ['treeLayout', 'treeDiagram']);
delete globalThis.document;
const { treeLayout } = env;

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const REGION = { x0: 100, x1: 900, y0: 300, y1: 1500 };

// ── layout invariants ─────────────────────────────────────

test('treeLayout positions the root-and-two-leaves tree at exact hand-computed positions', () => {
  const { nodes } = treeLayout({ name: 'root', children: [{ name: 'a' }, { name: 'b' }] }, REGION);
  const byDepth = d => nodes.filter(n => n.depth === d).sort((p, q) => p.x - q.x);
  const root = nodes.find(n => n.depth === 0);
  const leaves = byDepth(1);
  assert.ok(near(root.x, 500, 0.5), `root must sit at region centre, got ${root.x}`);
  assert.ok(near(leaves[0].x, 300, 0.5) && near(leaves[1].x, 700, 0.5), `leaves at quarter points, got ${leaves[0].x},${leaves[1].x}`);
  assert.equal(root.y, REGION.y0);
  assert.equal(leaves[0].y, REGION.y1);
});

test('treeLayout is deterministic — same data, same positions', () => {
  const data = { name: 'r', children: [{ name: 'a', children: [{ name: 'x' }, { name: 'y' }] }, { name: 'b' }] };
  const a = treeLayout(data, REGION), b = treeLayout(data, REGION);
  assert.deepEqual(a.nodes.map(n => [n.x, n.y]), b.nodes.map(n => [n.x, n.y]));
});

test('treeLayout keeps every node inside the region and rows aligned by depth', () => {
  const data = {
    name: 'r', children: [
      { name: 'a', children: [{ name: 'x' }, { name: 'y', children: [{ name: 'deep' }] }] },
      { name: 'b', children: [{ name: 'z' }] },
      { name: 'c' },
    ],
  };
  const { nodes } = treeLayout(data, REGION);
  for (const n of nodes) {
    assert.ok(n.x >= REGION.x0 - 0.01 && n.x <= REGION.x1 + 0.01, `x ${n.x} outside region`);
    assert.ok(n.y >= REGION.y0 - 0.01 && n.y <= REGION.y1 + 0.01, `y ${n.y} outside region`);
  }
  const rows = new Map();
  for (const n of nodes) {
    if (rows.has(n.depth)) assert.ok(near(rows.get(n.depth), n.y, 0.5), `depth ${n.depth} row misaligned`);
    else rows.set(n.depth, n.y);
  }
});

test('treeLayout parents sit strictly above their children', () => {
  const data = { name: 'r', children: [{ name: 'a', children: [{ name: 'x' }] }, { name: 'b' }] };
  const { nodes, links } = treeLayout(data, REGION);
  assert.equal(links.length, nodes.length - 1, 'a tree of n nodes has exactly n-1 links');
  for (const { a, b } of links) assert.ok(a.y < b.y, 'parent must be above child');
});

test('treeLayout never overlaps same-depth nodes — gap is at least one separation unit', () => {
  const data = {
    name: 'r', children: [
      { name: 'a', children: [{ name: 'a1' }, { name: 'a2' }, { name: 'a3' }] },
      { name: 'b', children: [{ name: 'b1' }, { name: 'b2' }] },
    ],
  };
  const { nodes, unitPx } = treeLayout(data, REGION);
  for (const depth of new Set(nodes.map(n => n.depth))) {
    const row = nodes.filter(n => n.depth === depth).sort((p, q) => p.x - q.x);
    for (let i = 1; i < row.length; i++) {
      assert.ok(row[i].x - row[i - 1].x >= unitPx * 0.99, `depth ${depth} overlap: gap ${row[i].x - row[i - 1].x} < unit ${unitPx}`);
    }
  }
});

test('treeLayout mirrors a symmetric tree symmetrically', () => {
  const leaf = (nm, kids) => ({ name: nm, children: kids });
  const data = {
    name: 'r', children: [
      leaf('a', [{ name: 'a1' }, { name: 'a2' }]),
      leaf('b', [{ name: 'b1' }, { name: 'b2' }]),
    ],
  };
  const { nodes } = treeLayout(data, REGION);
  const root = nodes.find(n => n.depth === 0);
  assert.ok(near(root.x, (REGION.x0 + REGION.x1) / 2, 0.5), `symmetric tree root must centre, got ${root.x}`);
  const at = nm => nodes.find(n => n.data.name === nm);
  const mid = (REGION.x0 + REGION.x1) / 2;
  for (const [l, r] of [['a1', 'b2'], ['a2', 'b1']]) {
    assert.ok(near(at(l).x + at(r).x, 2 * mid, 1), `${l}/${r} must mirror around centre`);
  }
});

test('treeLayout centres a degenerate chain on the midline', () => {
  const data = { name: 'r', children: [{ name: 'a', children: [{ name: 'b', children: [{ name: 'c' }] }] }] };
  const { nodes } = treeLayout(data, REGION);
  const mid = (REGION.x0 + REGION.x1) / 2;
  for (const n of nodes) assert.ok(near(n.x, mid, 0.5), `chain node must centre, got ${n.x}`);
});

test('treeLayout handles a single-node tree', () => {
  const { nodes, links } = treeLayout({ name: 'alone' }, REGION);
  assert.equal(nodes.length, 1);
  assert.equal(links.length, 0);
  assert.ok(near(nodes[0].x, (REGION.x0 + REGION.x1) / 2, 0.5));
  assert.equal(nodes[0].y, REGION.y0);
});

test('treeLayout reveal order is depth-first — every parent ordered before its children', () => {
  const data = { name: 'r', children: [{ name: 'a', children: [{ name: 'x' }] }, { name: 'b' }] };
  const { nodes, links } = treeLayout(data, REGION);
  for (const { a, b } of links) assert.ok(a.order < b.order, 'parent must reveal before child');
  const orders = nodes.map(n => n.order).sort((p, q) => p - q);
  assert.deepEqual(orders, nodes.map((_, i) => i), 'orders must be a permutation of 0..n-1');
});

test('treeLayout rejects invalid input', () => {
  assert.throws(() => treeLayout(null, REGION), TypeError);
  assert.throws(() => treeLayout({}, REGION), TypeError);
  assert.throws(() => treeLayout({ name: 'x' }, null), TypeError);
});

// ── drawing surface (stub context) ────────────────────────

const DATA = { name: 'root', children: [{ name: 'alpha', sub: '1350–1369' }, { name: 'beta', children: [{ name: 'leaf' }] }] };

test('treeDiagram draws nothing at p=0 and everything at p=1', () => {
  const spec = { data: DATA, ...REGION };
  const count = p => {
    ops.length = 0;
    env.treeDiagram(spec, p, {});
    return [...ops];
  };
  assert.equal(count(0).length, 0, 'p=0 must draw nothing');
  const full = count(1);
  const plates = full.filter(o => o === 'fillText').length;
  assert.ok(plates >= DATA.children.length + 2, `p=1 must draw all node labels, got ${plates}`);
});

test('treeDiagram reveals progressively — more p, more drawing', () => {
  const spec = { data: DATA, ...REGION };
  const count = p => {
    ops.length = 0;
    env.treeDiagram(spec, p, {});
    return ops.length;
  };
  assert.ok(count(0.3) < count(0.7), 'reveal must be progressive');
  assert.ok(count(0.7) < count(1), 'reveal must be progressive');
});

test('treeDiagram reveals the root before any leaf', () => {
  const spec = { data: DATA, ...REGION };
  const n = 4; // node count in DATA
  ops.length = 0; texts.length = 0;
  env.treeDiagram(spec, 0.9 / n, {});
  assert.deepEqual([...new Set(texts)], ['root'], 'only the root plate may be labelled during its own slot');
});
