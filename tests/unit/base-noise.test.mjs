/**
 * @file base-noise.test.mjs — noise2 is a deterministic 2D simplex field that never calls trigonometry or sqrt.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../helpers/load-script.mjs';

const load = () => loadScripts(['core/base.js'], ['noise2']).noise2;
const noise2 = load();

const grid = [];
for (let i = -60; i <= 60; i++) for (let j = -60; j <= 60; j++) grid.push(noise2(i * .37, j * .53));

test('noise2 is exactly zero at the origin', () => {
  assert.equal(noise2(0, 0), 0);
});

test('noise2 stays within about -1..1', () => {
  assert.ok(Math.max(...grid.map(Math.abs)) <= 1, `max |noise2| = ${Math.max(...grid.map(Math.abs))}`);
});

test('noise2 varies smoothly', () => {
  for (let i = 0; i < 2000; i++) {
    const x = i * .0137 - 13, y = i * .0291 - 29;
    assert.ok(Math.abs(noise2(x + .001, y) - noise2(x, y)) < .01, `at ${x}, ${y}`);
  }
});

test('noise2 is centred on zero and is not flat', () => {
  const mean = grid.reduce((s, v) => s + v, 0) / grid.length;
  const variance = grid.reduce((s, v) => s + (v - mean) ** 2, 0) / grid.length;
  assert.ok(Math.abs(mean) < .05, `mean ${mean}`);
  assert.ok(variance > .01, `variance ${variance}`);
});

test('noise2 depends only on its input, not on call order or on earlier loads', () => {
  const again = load();
  const pts = [[.5, .25], [-7.3, 12.1], [100.001, -.999], [3, 4]];
  const first = pts.map(([x, y]) => noise2(x, y));
  assert.deepEqual(pts.map(([x, y]) => again(x, y)), first);
  assert.deepEqual(pts.slice().reverse().map(([x, y]) => noise2(x, y)), first.slice().reverse());
});

test('noise2 matches pinned reference values', () => {
  assert.ok(Math.abs(noise2(1.5, 2.5) - (-0.18010876423407166)) < 1e-12);
  assert.ok(Math.abs(noise2(-7.3, 12.1) - 0.01853581789678832) < 1e-12);
  assert.ok(Math.abs(noise2(0.5, 0.25) - (-0.3925929917239749)) < 1e-12);
});

const refPerm = (() => {
  const h = n => { n = Math.imul(n ^ (n >>> 16), 0x7feb352d); n = Math.imul(n ^ (n >>> 15), 0x846ca68b); return (n ^ (n >>> 16)) >>> 0; };
  const p = Array.from({ length: 256 }, (_, k) => k);
  for (let k = 255; k > 0; k--) { const j = h(k ^ 0x5a17c3e9) % (k + 1); [p[k], p[j]] = [p[j], p[k]]; }
  return p;
})();
const REF_GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0, 1], [0, -1]];
const refNoise2 = (x, y) => {
  const F2 = (Math.sqrt(3) - 1) / 2, G2 = (3 - Math.sqrt(3)) / 6;
  const s = (x + y) * F2, I0 = Math.floor(x + s), J0 = Math.floor(y + s);
  let sum = 0;
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
    const I = I0 + a, J = J0 + b, t = (I + J) * G2;
    const dx = x - (I - t), dy = y - (J - t);
    const w = .5 - dx * dx - dy * dy;
    if (w <= 0) continue;
    const grad = REF_GRAD[refPerm[((I & 255) + refPerm[J & 255]) & 255] % 12];
    sum += w * w * w * w * (grad[0] * dx + grad[1] * dy);
  }
  return 70 * sum;
};

test('noise2 agrees with an independent kernel-sum reference that uses sqrt constants', () => {
  let s = 12345;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  let worst = 0;
  for (let k = 0; k < 5000; k++) {
    const x = (rnd() - .5) * 200, y = (rnd() - .5) * 200;
    worst = Math.max(worst, Math.abs(noise2(x, y) - refNoise2(x, y)));
  }
  assert.ok(worst < 1e-9, `worst difference ${worst}`);
});

test('noise2 never calls Math.sin, Math.cos or Math.sqrt', () => {
  const real = { sin: Math.sin, cos: Math.cos, sqrt: Math.sqrt };
  const trap = name => () => { throw new Error(`noise2 must not call Math.${name}`); };
  Math.sin = trap('sin'); Math.cos = trap('cos'); Math.sqrt = trap('sqrt');
  try {
    const f = load();
    for (let i = 0; i < 500; i++) f(i * .11, i * .07);
  } finally {
    Math.sin = real.sin; Math.cos = real.cos; Math.sqrt = real.sqrt;
  }
});

test('noise2 throws TypeError for coordinates that are not finite numbers', () => {
  for (const bad of [NaN, Infinity, '1', undefined]) {
    assert.throws(() => noise2(bad, 0), TypeError, `x: ${String(bad)}`);
    assert.throws(() => noise2(0, bad), TypeError, `y: ${String(bad)}`);
  }
});
