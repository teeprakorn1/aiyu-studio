/**
 * @file tests/unit/karaoke.test.mjs — karaoke word-mapping helpers from features/subtitles.js.
 * Run: node --test tests/unit/karaoke.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../helpers/load-script.mjs';

const env = loadScripts(['core/base.js', 'core/motion.js', 'features/subtitles.js'], ['karaokeMap', 'karaokeActiveIdx']);
const { karaokeMap, karaokeActiveIdx } = env;

const WORDS = [
  { w: 'This', t0: 0.1, dur: 0.3 },
  { w: 'is', t0: 0.45, dur: 0.2 },
  { w: 'demo', t0: 0.7, dur: 0.4 },
];

test('karaokeMap assigns chars to word indexes sequentially', () => {
  const map = karaokeMap('This is demo', WORDS);
  assert.equal(map[0], 0);   // T of This
  assert.equal(map[3], 0);   // s of This
  assert.equal(map[4], -1);  // space — unmatched, follows base styling
  assert.equal(map[5], 1);   // i of is
  assert.equal(map[8], 2);   // d of demo
});

test('karaokeMap tolerates words absent from text (subword mismatch)', () => {
  const map = karaokeMap('hello world', [{ w: 'zzz', t0: 0, dur: 1 }, { w: 'world', t0: 1, dur: 1 }]);
  assert.equal(map[6], 1);  // world still found after the missing word
  assert.equal(map[0], -1);
});

test('karaokeMap repeated words advance the search position', () => {
  const map = karaokeMap('go go', [{ w: 'go', t0: 0, dur: 1 }, { w: 'go', t0: 1, dur: 1 }]);
  assert.equal(map[0], 0);
  assert.equal(map[3], 1);  // second 'go' must map to the second word, not the first
});

test('karaokeActiveIdx tracks time-in-line with a small natural lead', () => {
  assert.equal(karaokeActiveIdx(WORDS, 0, 0.0), -1);    // before the first word
  assert.equal(karaokeActiveIdx(WORDS, 0, 0.12), 0);    // inside This (lead 0.04)
  assert.equal(karaokeActiveIdx(WORDS, 0, 0.5), 1);     // inside is
  assert.equal(karaokeActiveIdx(WORDS, 0, 0.62), 1);    // gap between words keeps last active
  assert.equal(karaokeActiveIdx(WORDS, 0, 0.67), 2);    // lead pulls the next word in slightly early — intended
  assert.equal(karaokeActiveIdx(WORDS, 0, 0.75), 2);    // inside demo
  // non-zero line start: words are absolute, tline is relative
  assert.equal(karaokeActiveIdx(WORDS, 0.1, 0.02), 0);  // w.t0 - lineT0 = 0 <= tline+lead
});

test('karaokeActiveIdx never goes backwards', () => {
  assert.ok(karaokeActiveIdx(WORDS, 0, 0.8) >= karaokeActiveIdx(WORDS, 0, 0.5));
});
