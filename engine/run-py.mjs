#!/usr/bin/env node
/**
 * @file run-py.mjs — cross-platform Python launcher for scaffolded npm scripts.
 * Resolution order honors env PYTHON, then py/python/python3 on Windows or python3/python/py elsewhere.
 * Fallback happens only when the interpreter itself is missing; script failures are propagated unchanged.
 */
import { spawnSync } from 'node:child_process';

const [script, ...args] = process.argv.slice(2);
if (!script) {
  console.error('usage: node engine/run-py.mjs <script.py> [args]');
  process.exit(2);
}

const candidates = process.env.PYTHON
  ? [process.env.PYTHON]
  : process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python', 'py'];

for (const py of candidates) {
  const probe = spawnSync(py, ['--version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) continue;
  const r = spawnSync(py, [script, ...args], { stdio: 'inherit' });
  if (r.error) throw r.error;
  process.exit(r.status ?? 1);
}

console.error(`no Python interpreter found; tried: ${candidates.join(', ')}`);
process.exit(127);
