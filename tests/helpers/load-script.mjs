/**
 * @file load-script.mjs — evaluate template classic scripts in Node for unit testing.
 * Template scripts are IIFE-wrapped and export through globalThis. Concatenating them
 * inside one Function reproduces the browser's shared classic-script environment for
 * logic-only tests that do not touch the DOM.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE = path.join(here, '..', '..', 'template');

/**
 * Load template scripts and capture exported names.
 *
 * @param {string[]} files - script paths relative to template/, in load order
 * @param {string[]} names - exported names to capture
 * @returns {object} captured bindings
 * @example
 * const { springy, ease } = loadScripts(['core/base.js', 'core/motion.js'], ['springy', 'ease']);
 */
export function loadScripts(files, names) {
  const src = files.map(f => readFileSync(path.join(TEMPLATE, f), 'utf8')).join('\n');
  const capture = `\n;return { ${names.join(', ')} };`;
  return new Function(src + capture)();
}
