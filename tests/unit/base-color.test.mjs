/**
 * @file base-color.test.mjs — mixHex and hexA accept only #rrggbb and throw on anything else.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../helpers/load-script.mjs';

const { mixHex, hexA } = loadScripts(['core/base.js'], ['mixHex', 'hexA']);

const NOT_HEX = ['#fff', '#ff000080', 'white', 'rgb(255,255,255)', 'rgba(255,255,255,1)', '', 'ffffff', '#gggggg', ' #ffffff', '#ffffff ', undefined, null, 0xffffff];

test('mixHex keeps its rgb() output for valid #rrggbb input', () => {
  assert.equal(mixHex('#ffffff', '#000000', .5), 'rgb(128,128,128)');
  assert.equal(mixHex('#2A1E16', '#87513C', .72), 'rgb(109,67,49)');
  assert.equal(mixHex('#16241A', '#6A4A44', .18), 'rgb(37,43,34)');
  assert.equal(mixHex('#ff0000', '#00ff00', .25), 'rgb(191,64,0)');
});

test('mixHex returns its endpoints at p = 0 and p = 1', () => {
  assert.equal(mixHex('#ffffff', '#000000', 0), 'rgb(255,255,255)');
  assert.equal(mixHex('#ffffff', '#000000', 1), 'rgb(0,0,0)');
});

test('mixHex clamps p to 0..1', () => {
  assert.equal(mixHex('#ffffff', '#000000', 1.2), 'rgb(0,0,0)');
  assert.equal(mixHex('#ffffff', '#000000', -.5), 'rgb(255,255,255)');
});

test('mixHex throws TypeError for any color that is not #rrggbb', () => {
  for (const bad of NOT_HEX) {
    assert.throws(() => mixHex(bad, '#000000', .5), TypeError, `first color: ${String(bad)}`);
    assert.throws(() => mixHex('#000000', bad, .5), TypeError, `second color: ${String(bad)}`);
  }
});

test('a mixHex result cannot be fed back in as a color', () => {
  assert.throws(() => mixHex(mixHex('#ffffff', '#000000', .5), '#000000', .5), TypeError);
});

test('hexA keeps its rgba() output for valid #rrggbb input', () => {
  assert.equal(hexA('#ff0000', .5), 'rgba(255,0,0,0.5)');
  assert.equal(hexA('#2A1E16', .18), 'rgba(42,30,22,0.18)');
  assert.equal(hexA('#000000', 0), 'rgba(0,0,0,0)');
  assert.equal(hexA('#ffffff', 1), 'rgba(255,255,255,1)');
});

test('hexA clamps alpha to 0..1', () => {
  assert.equal(hexA('#ff0000', 1.5), 'rgba(255,0,0,1)');
  assert.equal(hexA('#ff0000', -1), 'rgba(255,0,0,0)');
});

test('hexA throws TypeError for any color that is not #rrggbb', () => {
  for (const bad of NOT_HEX) assert.throws(() => hexA(bad, .5), TypeError, `color: ${String(bad)}`);
});

test('non-finite p or alpha throws TypeError instead of returning NaN', () => {
  for (const bad of [NaN, Infinity, -Infinity, '0.5', undefined, null]) {
    assert.throws(() => mixHex('#ffffff', '#000000', bad), TypeError, `p: ${String(bad)}`);
    assert.throws(() => hexA('#ffffff', bad), TypeError, `alpha: ${String(bad)}`);
  }
});

const lerp = (a, b, p) => a + (b - a) * p;
const legacyMixHex = (a, b, p) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp(pa >> 16, pb >> 16, p));
  const gg = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, p));
  const bl = Math.round(lerp(pa & 255, pb & 255, p));
  return `rgb(${r},${gg},${bl})`;
};
const legacyHexA = (hex, a) => {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`;
};

test('valid input gives the same strings as the previous formulas over 2000 fixed cases', () => {
  let s = 2024;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const hex = () => '#' + Array.from({ length: 6 }, () => '0123456789abcdefABCDEF'[Math.floor(rnd() * 22)]).join('');
  for (let k = 0; k < 2000; k++) {
    const a = hex(), b = hex(), p = rnd(), alpha = rnd();
    assert.equal(mixHex(a, b, p), legacyMixHex(a, b, p), `mixHex(${a}, ${b}, ${p})`);
    assert.equal(hexA(a, alpha), legacyHexA(a, alpha), `hexA(${a}, ${alpha})`);
  }
});
