/**
 * @file determinism-static.test.mjs — scene code must not read wall-clock time or unseeded randomness (Determinism Law).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FORBIDDEN = [/\bMath\.random\s*\(/, /\bDate\.now\s*\(/, /\bperformance\.now\s*\(/, /\bnew\s+Date\s*\(/, /\bcrypto\.getRandomValues\b/];
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
const jsFiles = dir => readdirSync(dir).flatMap(f => {
  const p = path.join(dir, f);
  return statSync(p).isDirectory() ? jsFiles(p) : (f.endsWith('.js') ? [p] : []);
});

test('template core, features, and story never read wall-clock time or unseeded randomness', () => {
  const hits = [];
  for (const d of ['core', 'features', 'story']) {
    for (const file of jsFiles(path.join(ROOT, 'template', d))) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const re of FORBIDDEN) if (re.test(src)) hits.push(`${path.relative(ROOT, file)} matches ${re}`);
    }
  }
  assert.deepEqual(hits, []);
});
