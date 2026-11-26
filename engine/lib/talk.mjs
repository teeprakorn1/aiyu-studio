/**
 * @file talk.mjs — generated talk.js helpers for engine scripts.
 */
import { readFileSync } from 'node:fs';

/**
 * Read the generated TALK object without evaluating arbitrary JavaScript.
 *
 * @param {string} file - path to talk.js
 * @returns {{ dur: number, lines: object[] }} parsed talk data
 */
export function readTalk(file) {
  const src = readFileSync(file, 'utf8');
  const m = src.match(/^const TALK=(\{[\s\S]*\});?\s*$/);
  if (!m) throw new Error(`invalid talk.js format: ${file}`);
  const talk = JSON.parse(m[1]);
  if (!Number.isFinite(talk.dur) || talk.dur <= 0) throw new Error(`invalid talk.js duration in ${file}`);
  return talk;
}
