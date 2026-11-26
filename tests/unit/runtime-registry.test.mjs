/**
 * @file runtime-registry.test.mjs — explicit runtime registration contract and feature decoupling.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../helpers/load-script.mjs';

const api = loadScripts(['core/base.js', 'core/registry.js', 'core/motion.js', 'features/character.js'], [
  'defineCharacters', 'definePeople', 'defineScenes', 'defineSourceChips', 'setFootnote',
  'registerPortraitRenderer', 'characterOf', 'personConfigOf', 'runtimeConfig',
]);

test('character registry stores author cast and reports unknown ids clearly', () => {
  api.defineCharacters({ host: { skin: '#fff' }, guest: { skin: '#eee' } });
  assert.equal(api.characterOf('host').skin, '#fff');
  assert.throws(() => api.characterOf('missing'), /unknown character 'missing'/);
});

test('people registry stores cinematic cast entries', () => {
  api.definePeople({ elder: { skin: '#a76' } });
  assert.equal(api.personConfigOf('elder').skin, '#a76');
  assert.throws(() => api.personConfigOf('missing'), /unknown personTH character/);
});

test('scene registration validates shape', () => {
  const scene = () => {};
  api.defineScenes([[2, scene], [Infinity, scene]]);
  assert.equal(api.runtimeConfig().scenes.length, 2);
  assert.throws(() => api.defineScenes([[2, 'not-a-function']]), /defineScenes/);
  assert.throws(() => api.defineScenes([[4, scene], [2, scene], [Infinity, scene]]), /sorted/);
  assert.throws(() => api.defineScenes([[2, scene]]), /Infinity/);
});

test('story metadata registration is explicit', () => {
  api.defineSourceChips([[1, 2, 'source']]);
  api.setFootnote('note');
  assert.equal(api.runtimeConfig().sourceChips[0][2], 'source');
  assert.equal(api.runtimeConfig().footnote, 'note');
});

test('character module registers its portrait renderer through the core registry', () => {
  assert.equal(typeof api.runtimeConfig().portrait, 'function');
});
