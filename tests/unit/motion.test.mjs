/**
 * @file motion.test.mjs — unit tests for core/motion.js curves (the determinism crown jewels).
 * These curves drive every visual in every production; a regression here corrupts all output.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../helpers/load-script.mjs';

const { ease, easeInOut, easeBack, easeElastic, springy, clamp01, lerp, rv, wordT, rvw } =
  loadScripts(['core/base.js', 'core/motion.js'], ['ease', 'easeInOut', 'easeBack', 'easeElastic', 'springy', 'clamp01', 'lerp', 'rv', 'wordT', 'rvw']);

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

/* ---- wordT / rvw — keyword-beat reveal helpers (v0.4.0) ---- */

const LINE = {
  t0: 10, dur: 4, txt: 'the price hit 42 today',
  words: [
    { w: 'the', t0: 10.0 }, { w: 'price', t0: 10.4 }, { w: 'hit', t0: 11.0 }, { w: '42', t0: 11.5 },
  ],
};

test('wordT returns absolute time of first matching word', () => {
  assert.equal(wordT(LINE, '42'), 11.5);
  assert.equal(wordT(LINE, 'price'), 10.4);
});

test('wordT normalizes punctuation and case', () => {
  const ln = { t0: 0, dur: 1, words: [{ w: '42,', t0: 0.3 }] };
  assert.equal(wordT(ln, '42'), 0.3);
  assert.equal(wordT(ln, '42!'), 0.3);
});

test('wordT substring tolerance both directions (Thai subword reality)', () => {
  const ln = { t0: 0, dur: 2, words: [{ w: 'ราคา', t0: 0.5 }] };
  assert.equal(wordT(ln, 'ราคาสินค้า'), 0.5);  // needle contains candidate
  assert.equal(wordT(ln, 'รา'), 0.5);          // candidate contains needle
});

test('wordT null when no words, empty needle, or no match', () => {
  assert.equal(wordT({ t0: 0, dur: 1 }, 'x'), null);
  assert.equal(wordT(LINE, ''), null);
  assert.equal(wordT(LINE, 'zzzz'), null);
});

test('rvw is 0 before the keyword and ramps only after it', () => {
  // word 42 at offset 1.5s into a 4s line; lp 0.3 -> tline 1.2 (before) -> 0
  assert.equal(rvw({ i: 0, lp: 0.3, line: LINE }, 0, '42'), 0);
  // exactly at the word -> still 0 (reveal starts at the word)
  assert.equal(rvw({ i: 0, lp: 1.5 / 4, line: LINE }, 0, '42'), 0);
  // halfway through the remaining 2.5s -> wp 0.5 -> min(1, 0.5*1.7) = 0.85
  assert.ok(Math.abs(rvw({ i: 0, lp: 2.75 / 4, line: LINE }, 0, '42') - 0.85) < 1e-9);
});

test('rvw line-index envelope matches rv: 0 before line, 1 after', () => {
  assert.equal(rvw({ i: 0, lp: 0.9, line: LINE }, 1, '42'), 0);   // i < n
  assert.equal(rvw({ i: 2, lp: 0, line: LINE }, 1, '42'), 1);     // i > n
});

test('rvw FALLBACK CONTRACT: identical to rv when words absent or needle unmatched', () => {
  for (const lp of [0, 0.25, 0.5, 0.9, 1]) {
    // no words at all
    const bare = { t0: 10, dur: 4 };
    assert.equal(rvw({ i: 0, lp, line: bare }, 0, '42'), rv({ i: 0, lp, line: bare }, 0));
    // words present but needle absent
    assert.equal(rvw({ i: 0, lp, line: LINE }, 0, 'zzzz'), rv({ i: 0, lp, line: LINE }, 0));
  }
});

test('rvw degrades to rv when word sits at the very end (no room to ramp)', () => {
  const tail = { t0: 10, dur: 4, words: [{ w: 'end', t0: 13.9999 }] };
  assert.equal(rvw({ i: 0, lp: 0.5, line: tail }, 0, 'end'), rv({ i: 0, lp: 0.5, line: tail }, 0));
});

test('rvw is deterministic — same input, same output (parallel chunk safety)', () => {
  const a = rvw({ i: 0, lp: 0.7, line: LINE }, 0, 'price');
  const b = rvw({ i: 0, lp: 0.7, line: LINE }, 0, 'price');
  assert.equal(a, b);
});
