/**
 * @file tests/unit/sketch.test.mjs — hand-drawn sketch primitives: determinism is the contract.
 * Parallel chunk rendering renders the same t in different processes — identical seeds MUST
 * produce identical point sequences, and boil must quantize (not continuously reseed).
 * Run: node --test tests/unit/sketch.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../helpers/load-script.mjs';

const env = loadScripts(['core/base.js', 'core/motion.js', 'features/sketch.js'],
  ['sketchLine', 'sketchRect', 'sketchCircle', 'sketchArrow', 'sketchUnderline', 'sketchPts']);
const { sketchPts } = env;

test('sketchPts is bitwise deterministic — same input, identical output (parallel-chunk contract)', () => {
  const a = sketchPts(0, 0, 100, 50, 42, 1, 1, 0);
  const b = sketchPts(0, 0, 100, 50, 42, 1, 1, 0);
  assert.deepEqual(a, b);
});

test('sketchPts differs across seeds and across passes', () => {
  const base = sketchPts(0, 0, 100, 50, 42, 1, 1, 0);
  assert.notDeepEqual(sketchPts(0, 0, 100, 50, 43, 1, 1, 0), base);
  assert.notDeepEqual(sketchPts(0, 0, 100, 50, 42, 1, 1, 1), base);
});

test('sketchPts jitter magnitudes stay in hand-drawn range — not glitch, not aliasing', () => {
  const pts = sketchPts(0, 0, 200, 0, 42, 1, 1, 0);
  for (let i = 1; i < pts.length; i += 2) {
    assert.ok(Math.abs(pts[i]) < 8, `y-offset ${pts[i]} too large — reads as glitch`);
    assert.ok(Math.abs(pts[i]) > 0.0001 || i < 4, 'zero jitter — no hand-drawn quality');
  }
});

test('sketchPts handles degenerate input without throwing', () => {
  assert.doesNotThrow(() => sketchPts(0, 0, 0, 0, 1, 1, 1, 0));      // zero length
  assert.doesNotThrow(() => sketchPts(-50, -50, 50, 50, 1, 0, 0, 0)); // zero roughness/bow
});

test('primitives draw without throwing on a recording stub context', () => {
  const ops = [];
  const stub = new Proxy({}, {
    get: (t, k) => (...a) => ops.push(k),
    set: () => true,
  });
  globalThis.g = stub;
  for (const fn of ['sketchLine', 'sketchRect', 'sketchCircle', 'sketchArrow', 'sketchUnderline']) {
    const args = { sketchLine: [0, 0, 10, 10], sketchRect: [0, 0, 10, 10], sketchCircle: [5, 5, 10], sketchArrow: [0, 0, 10, 10], sketchUnderline: [0, 0, 10] }[fn];
    assert.doesNotThrow(() => env[fn](...args, { seed: 42, boil: 3, t: 1.234 }), fn);
  }
  assert.ok(ops.filter(o => o === 'stroke').length >= 8, 'double-stroke passes must reach the canvas');
});

test('boil quantizes time — same bucket same jitter, next bucket different jitter', () => {
  // boil=3 means re-seed every 3 frames at 30fps -> bucket = floor(t*10)
  // this property is what keeps boil a pure function of t (chunk-safe squigglevision)
  const calls = [];
  globalThis.g = new Proxy({}, {
    get: (t, k) => (...a) => { if (k === 'moveTo' || k === 'lineTo') calls.push([k, ...a]); },
    set: () => true,
  });
  const draw = t => { calls.length = 0; env.sketchLine(0, 0, 200, 0, { seed: 42, boil: 3, t }); return calls.slice(); };
  assert.deepEqual(draw(0.05), draw(0.09));
  assert.notDeepEqual(draw(0.05), draw(0.35));
});
