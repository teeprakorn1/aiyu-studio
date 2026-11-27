/**
 * @file proc.mjs — shared process helpers for e2e tests.
 * Windows npm is invoked through cmd.exe with one static command line because direct
 * .cmd spawning is restricted; this avoids both ENOENT and DEP0190 argument concatenation.
 * ffmpeg and ffprobe resolve from PATH only, never from the current directory.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { resolveExecutable } from '../../engine/lib/exec.mjs';

function resolvePython() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const candidates = process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python', 'py'];
  for (const cmd of candidates) {
    let exe;
    try { exe = resolveExecutable(cmd); } catch { continue; }
    const r = spawnSync(exe, ['--version'], { stdio: 'ignore' });
    if (!r.error && r.status === 0) return exe;
  }
  return candidates[0];
}

export const PY = resolvePython();

const toolPath = cmd => (cmd === 'ffmpeg' || cmd === 'ffprobe' ? resolveExecutable(cmd) : cmd);

/**
 * Run a process and capture stdout; failures throw with stderr attached.
 *
 * @param {string} cmd - executable name (ffmpeg and ffprobe resolve from PATH)
 * @param {string[]} args - argument list
 * @param {string} cwd - working directory
 * @returns {string} captured stdout
 */
export function run(cmd, args, cwd) {
  return execFileSync(toolPath(cmd), args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function cmdQuote(s) {
  const text = String(s);
  return /^[A-Za-z0-9_./:=+,@%^\-]+$/.test(text) ? text : `"${text.replace(/"/g, '\\"')}"`;
}

/**
 * Run npm cross-platform; args are static test input, never user-controlled shell text.
 * On failure the error carries the tail of npm's stderr so CI logs show the cause.
 *
 * @param {string[]} args - npm arguments
 * @param {string} cwd - working directory
 * @returns {string} captured stdout
 */
export function npmExec(args, cwd) {
  const stdio = ['ignore', 'pipe', 'pipe'];
  try {
    if (process.platform === 'win32') {
      const line = ['npm', ...args].map(cmdQuote).join(' ');
      return execFileSync('cmd.exe', ['/d', '/s', '/c', line], { cwd, encoding: 'utf8', stdio });
    }
    return execFileSync('npm', args, { cwd, encoding: 'utf8', stdio });
  } catch (err) {
    throw new Error(`npm ${args.join(' ')} failed in ${cwd}:\n${String(err.stderr || err.stdout || err.message).slice(-2000)}`);
  }
}

/**
 * Install scaffold dependencies from the lockfile.
 *
 * @param {string} cwd - scaffolded project folder
 * @returns {string} npm output
 */
export function npmInstall(cwd) {
  return npmExec(['ci', '--no-fund', '--no-audit', '--silent'], cwd);
}

/**
 * Run an npm script, forwarding args after `--` when present.
 *
 * @param {string} script - npm script name
 * @param {string[]} args - script arguments
 * @param {string} cwd - working directory
 * @returns {string} captured stdout
 */
export function npmRun(script, args, cwd) {
  return npmExec(['run', script, ...(args?.length ? ['--', ...args] : [])], cwd);
}
