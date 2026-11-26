/**
 * @file motion.test.mjs — unit tests for core/motion.js curves (the determinism crown jewels).
 * These curves drive every visual in every production; a regression here corrupts all output.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../helpers/load-script.mjs';

const { ease, easeInOut, easeBack, easeElastic, springy, clamp01, lerp, rv } =
  loadScripts(['core/base.js', 'core/motion.js'], ['ease', 'easeInOut', 'easeBack', 'easeElastic', 'springy', 'clamp01', 'lerp', 'rv']);

const STEPS = Array.from({ length: 101 }, (_, i) => i / 100);

test('all curves are finite (no NaN/Infinity) across [0,1]', () => {
  for (const fn of [ease, easeInOut, easeBack, easeElastic, springy]) {
    for (const p of STEPS) assert.ok(Number.isFinite(fn(p)), `${fn.name}(${p}) not finite`);
  }
});

test('ease endpoints exact, monotonic, never overshoots', () => {
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  for (let i = 1; i < STEPS.length; i++) assert.ok(ease(STEPS[i]) >= ease(STEPS[i - 1]));
  for (const p of STEPS) assert.ok(ease(p) <= 1);
});

test('easeInOut symmetric-ish endpoints exact', () => {
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.ok(Math.abs(easeInOut(0.5) - 0.5) < 1e-9);
});

test('easeBack overshoots but settles exactly at 1', () => {
  assert.equal(easeBack(1), 1);
  assert.ok(Math.max(...STEPS.map(easeBack)) > 1.05, 'must overshoot visibly');
});

test('easeElastic endpoints exact, oscillates around 1 mid-flight', () => {
  assert.equal(easeElastic(0), 0);
  assert.equal(easeElastic(1), 1);
  assert.ok(STEPS.some(p => easeElastic(p) > 1) && STEPS.some(p => easeElastic(p) < 1 && p > 0.3));
});

test('springy overshoots then settles — exact damped harmonic physics', () => {
  assert.equal(springy(0), 0);
  const peak = Math.max(...STEPS.map(p => springy(p)));
  assert.ok(peak > 1.1 && peak < 1.35, `overshoot in sane range, got ${peak}`);
  assert.ok(Math.abs(springy(1) - 1) < 0.01, 'settled at end');
});

test('springy stiffness/damping params change behavior', () => {
  const stiff = springy(0.3, 300, 12);
  const soft = springy(0.3, 80, 12);
  assert.notEqual(stiff, soft);
});

test('curves are pure — same input, same output, always', () => {
  for (let i = 0; i < 10; i++) assert.equal(springy(0.42), springy(0.42));
});

test('clamp01/lerp primitives', () => {
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(-1), 0);
  assert.equal(lerp(10, 20, 0.5), 15);
});

test('rv line-scoped reveal: 0 before line, ramps during, 1 after', () => {
  assert.equal(rv({ i: 1, lp: 0.5 }, 3), 0);        // line not reached yet
  assert.equal(rv({ i: 3, lp: 0.5 }, 3, 1), 0.5);   // mid-reveal on its own line
  assert.equal(rv({ i: 4, lp: 0 }, 3), 1);          // after the line
});
