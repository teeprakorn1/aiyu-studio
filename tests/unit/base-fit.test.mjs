/**
 * @file base-fit.test.mjs — fitTXT shrinks text to fit maxW using a recording canvas stub.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../helpers/load-script.mjs';

const draws = [];
const ctx = {
  font: '',
  measureText: t => ({ width: t.length * Number(/(\d+)px/.exec(ctx.font)[1]) * 0.5 }),
  fillText: (t) => draws.push({ t, font: ctx.font }),
};
globalThis.document = { getElementById: () => ({ getContext: () => ctx }) };
const api = loadScripts(['core/base.js'], ['fitTXT', 'TXT']);
delete globalThis.document;

test('fitTXT keeps the requested size when the text already fits', () => {
  draws.length = 0;
  assert.equal(api.fitTXT('abc', 0, 0, 200, 52, '#fff'), 52);
  assert.match(draws.at(-1).font, /52px/);
});

test('fitTXT shrinks in 2 px steps until the text fits maxW', () => {
  assert.equal(api.fitTXT('abc', 0, 0, 50, 52, '#fff'), 32);
});

test('fitTXT never goes below 24 px', () => {
  assert.equal(api.fitTXT('x'.repeat(200), 0, 0, 50, 52, '#fff'), 24);
});
