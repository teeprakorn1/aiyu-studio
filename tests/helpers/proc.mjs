/**
 * @file proc.mjs — shared process helpers for e2e tests.
 * Windows npm is invoked through cmd.exe with one static command line because direct
 * .cmd spawning is restricted; this avoids both ENOENT and DEP0190 argument concatenation.
 */
import { execFileSync, spawnSync } from 'node:child_process';

function resolvePython() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const candidates = process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python', 'py'];
  for (const cmd of candidates) {
    const r = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
    if (!r.error && r.status === 0) return cmd;
  }
  return candidates[0];
}

export const PY = resolvePython();

/** Run a process with inherited-input/captured-output e2e defaults. */
export function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function cmdQuote(s) {
  const text = String(s);
  return /^[A-Za-z0-9_./:=+,@%^\-]+$/.test(text) ? text : `"${text.replace(/"/g, '\\"')}"`;
}

/** Run npm cross-platform; args are static test input, never user-controlled shell text. */
export function npmExec(args, cwd, opts = {}) {
  if (process.platform === 'win32') {
    const line = ['npm', ...args].map(cmdQuote).join(' ');
    return execFileSync('cmd.exe', ['/d', '/s', '/c', line], { cwd, encoding: 'utf8', stdio: opts.quiet ? 'ignore' : ['ignore', 'pipe', 'pipe'] });
  }
  return execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: opts.quiet ? 'ignore' : ['ignore', 'pipe', 'pipe'] });
}

/** Install scaffold dependencies quietly. */
export function npmInstall(cwd) {
  return npmExec(['ci', '--no-fund', '--no-audit', '--silent'], cwd, { quiet: true });
}

/** Run an npm script, forwarding args after `--` when present. */
export function npmRun(script, args, cwd) {
  return npmExec(['run', script, ...(args?.length ? ['--', ...args] : [])], cwd);
}
