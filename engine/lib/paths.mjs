/**
 * @file paths.mjs — containment checks for user-supplied relative paths.
 */
import path from 'node:path';

const norm = p => (process.platform === 'win32' ? p.toLowerCase() : p);

/**
 * Resolve a relative path against root and reject anything that escapes root.
 *
 * @param {string} root - project root directory
 * @param {string} rel - user-supplied relative path
 * @returns {string} absolute path inside root
 * @throws {Error} when the resolved path is outside root
 */
export function resolveInside(root, rel) {
  const base = path.resolve(root);
  const abs = path.resolve(base, rel);
  if (norm(abs) !== norm(base) && !norm(abs).startsWith(norm(base) + path.sep)) throw new Error(`path escapes the project folder: ${rel}`);
  return abs;
}
