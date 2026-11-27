/**
 * @file architecture.test.mjs — static guardrails: the runtime dependency-direction law, the wrapper shape, and the JSDoc policy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { declaration, docBefore, exportedNames } from '../helpers/source.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => readFileSync(path.join(ROOT, f), 'utf8');
const jsIn = dir => readdirSync(path.join(ROOT, 'template', dir)).filter(f => f.endsWith('.js')).map(f => `template/${dir}/${f}`);
const IIFE = /^\/\*\*[\s\S]*?\*\/\s*(?:\/\/[^\n]*\s*)*\(\(\) => \{/;

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

test('core runtime does not call feature functions directly (overlays are registered instead)', () => {
  assert.doesNotMatch(read('template/core/runtime.js'), /\bsubs\s*\(/);
});

test('every core and feature module uses an explicit IIFE/globalThis export wrapper', () => {
  for (const f of [...jsIn('core'), ...jsIn('features')]) {
    const src = read(f).trim();
    assert.match(src, IIFE, `${f} must be IIFE-wrapped after its file header`);
    assert.ok(src.includes('Object.assign(globalThis,'), `${f} must export explicitly`);
    assert.ok(src.endsWith('})();'), `${f} must close its IIFE`);
  }
});

test('exported functions in core/base.js, features/environment.js, and features/atmosphere.js carry JSDoc with every parameter and a return', () => {
  const problems = [];
  for (const f of ['template/core/base.js', 'template/features/environment.js', 'template/features/atmosphere.js']) {
    const src = read(f);
    for (const name of exportedNames(src)) {
      const decl = declaration(src, name);
      if (!decl) continue;
      const doc = docBefore(src, decl.index);
      if (!doc) { problems.push(`${f}: ${name} has no JSDoc block`); continue; }
      for (const p of decl.params) {
        if (!new RegExp(`@param\\s+\\{[^}]*\\}\\s+\\[?${p}\\b`).test(doc)) problems.push(`${f}: ${name} lacks @param ${p}`);
      }
      if (!doc.includes('@returns')) problems.push(`${f}: ${name} lacks @returns`);
    }
  }
  assert.deepEqual(problems, []);
});
