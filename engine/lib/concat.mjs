/**
 * @file concat.mjs — parse ffmpeg concat-demuxer lists and keep every entry inside the project.
 */
import path from 'node:path';
import { resolveInside } from './paths.mjs';

/**
 * Parse concat-demuxer text into absolute chunk paths. Entries are relative to the list file.
 *
 * @param {string} text - contents of the concat list
 * @param {string} listDir - directory containing the list file
 * @param {string} root - project root that every entry must stay inside
 * @returns {string[]} absolute chunk paths in list order
 * @throws {Error} on unsupported lines, absolute entries, or entries that escape root
 */
export function parseConcatList(text, listDir, root) {
  const files = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^file\s+(.+)$/i);
    if (!m) throw new Error(`unsupported concat-list line: ${line}`);
    let p = m[1].trim();
    if ((p.startsWith("'") && p.endsWith("'")) || (p.startsWith('"') && p.endsWith('"'))) p = p.slice(1, -1);
    p = p.replace(/'\\''/g, "'");
    if (path.isAbsolute(p)) throw new Error(`concat entries must be relative to the list file: ${p}`);
    files.push(resolveInside(root, path.relative(root, path.resolve(listDir, p))));
  }
  if (!files.length) throw new Error('concat list has no file entries');
  return files;
}
