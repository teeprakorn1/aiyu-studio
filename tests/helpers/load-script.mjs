/**
 * @file load-script.mjs — evaluate template classic scripts in Node for unit testing.
 * Classic scripts share a global lexical scope across files; we reproduce that by
 * concatenating sources and capturing the wanted names in one eval — no browser needed
 * as long as the exercised code paths do not touch the DOM.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE = path.join(here, '..', '..', 'template');

/**
 * Load template scripts and capture top-level const/function bindings.
 *
 * @param {string[]} files - script paths relative to template/, in load order
 * @param {string[]} names - binding names to capture
 * @returns {object} captured bindings
 * @example
 * const { springy, ease } = loadScripts(['core/base.js', 'core/motion.js'], ['springy', 'ease']);
 */
export function loadScripts(files, names) {
  const src = files.map(f => readFileSync(path.join(TEMPLATE, f), 'utf8')).join('\n');
  const capture = `\n;return { ${names.join(', ')} };`;
  // strip DOM-touching lines that never execute in logic paths but would throw at load time
  const safe = src
    .replace(/const g = document\.getElementById\(.*$/m, 'const g = null;')
    .replace(/const L = TALK\.lines;/, 'const L = [];')
    .replace(/window\.rv = /, 'var rv = ');
  return new Function(safe + capture)();
}
