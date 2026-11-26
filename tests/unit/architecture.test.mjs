/**
 * @file architecture.test.mjs — static guardrails for the runtime dependency-direction law.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..', '..');
const read = f => readFileSync(path.join(ROOT, f), 'utf8');

test('cards do not depend on character internals or story CH globals', () => {
  const src = read('template/features/cards.js');
  assert.doesNotMatch(src, /\bhairBack\s*\(|\bhairFront\s*\(|\bface\s*\(/);
  assert.doesNotMatch(src, /\bCH\s*\[/);
});

test('character and people renderers resolve cast through the registry', () => {
  assert.match(read('template/features/character.js'), /\bcharacterOf\s*\(/);
  assert.doesNotMatch(read('template/features/character.js'), /\bCH\s*\[/);
  assert.match(read('template/features/people.js'), /\bpersonConfigOf\s*\(/);
  assert.doesNotMatch(read('template/features/people.js'), /\bPCH\s*\[/);
});

test('legacy people config adoption is not blocked by built-in personTH defaults', () => {
  const src = read('template/core/runtime.js');
  assert.match(src, /typeof PCH !== 'undefined'\)\s*definePeople\(PCH\)/);
  assert.doesNotMatch(src, /Object\.keys\(st\.people\)\.length/);
});

test('core and regular feature files use explicit IIFE/globalThis export wrappers', () => {
  for (const f of [
    'template/core/base.js', 'template/core/motion.js', 'template/core/camera.js', 'template/core/runtime.js',
    'template/features/subtitles.js', 'template/features/character.js', 'template/features/environment.js', 'template/features/cards.js', 'template/features/sketch.js',
  ]) {
    const src = read(f).trim();
    assert.match(src, /^\/\*\*[\s\S]*?\*\/\s*\(\(\) => \{/, `${f} must be IIFE-wrapped after its file header`);
    assert.ok(src.includes('Object.assign(globalThis,'), `${f} must export explicitly`);
    assert.ok(src.endsWith('})();'), `${f} must close its IIFE`);
  }
});
