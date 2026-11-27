/**
 * @file exec.mjs — resolve external executables from PATH only; the current directory is never searched.
 */
import { accessSync, constants, lstatSync } from 'node:fs';
import path from 'node:path';

const isExecutable = file => {
  try {
    if (lstatSync(file).isDirectory()) return false;
    if (process.platform !== 'win32') accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Resolve a bare command name to an absolute executable path using PATH entries only.
 *
 * @param {string} name - bare command name such as 'ffmpeg', or an absolute executable path
 * @param {Object<string, string>} [env=process.env] - environment whose PATH is searched
 * @returns {string} absolute path of the executable
 * @throws {Error} when no PATH entry provides the executable
 */
export function resolveExecutable(name, env = process.env) {
  if (path.isAbsolute(name)) {
    if (isExecutable(name)) return name;
    throw new Error(`${name} is not an executable file`);
  }
  if (name.includes('/') || name.includes('\\')) throw new Error(`${name}: use a bare command name resolved from PATH`);
  const exts = process.platform === 'win32' && !path.extname(name) ? ['.exe', '.com'] : [''];
  for (const dir of (env.PATH ?? env.Path ?? '').split(path.delimiter)) {
    if (!dir || !path.isAbsolute(dir)) continue;
    for (const ext of exts) {
      const file = path.join(dir, name + ext);
      if (isExecutable(file)) return file;
    }
  }
  throw new Error(`${name} not found on PATH — install it and add its folder to PATH (the current directory is intentionally not searched)`);
}
