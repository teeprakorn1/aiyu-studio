/**
 * @file determinism.test.mjs — enforces the Determinism Law of AGENTS.md:
 * render(t) must be a pure function of t. Same time, same pixels, always.
 * Also smoke-checks visual stability via golden stills with tolerant byte comparison.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, readFileSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(here, '..', '..');
const PROJ = path.join(here, '.tmp-determinism');
const GOLDENS = path.join(here, 'fixtures', 'golden');
const PY = process.env.PYTHON || 'py';
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(cmd, args, cwd = PROJ) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');

before(function () {
  rmSync(PROJ, { recursive: true, force: true });
  run(PY, [path.join(REPO, 'new-project.py'), PROJ], REPO);
  execFileSync(NPM, ['install', '--no-fund', '--no-audit', '--silent'], { cwd: PROJ, shell: true, stdio: 'ignore' });
  run(PY, ['engine/mix-studio.py', '--stub']);
});

after(() => { rmSync(PROJ, { recursive: true, force: true }); });

test('rendering the same timestamp twice yields pixel-identical output', () => {
  run('node', ['engine/render.mjs', 'stills', '5']);
  const first = path.join(PROJ, 'stills', 't5.000.jpg');
  const h1 = sha(first);
  // second render overwrites the same file — hashes must match exactly
  run('node', ['engine/render.mjs', 'stills', '5']);
  const h2 = sha(first);
  assert.equal(h1, h2, 'DETERMINISM LAW VIOLATION: same t rendered different pixels — check for Math.random()/Date.now() in render paths');
});

test('different timestamps render different content (sanity)', () => {
  run('node', ['engine/render.mjs', 'stills', '2,8']);
  const a = sha(path.join(PROJ, 'stills', 't2.000.jpg'));
  const b = sha(path.join(PROJ, 'stills', 't8.000.jpg'));
  assert.notEqual(a, b);
});

test('golden stills within byte-size tolerance (visual regression smoke)', (t) => {
  if (!existsSync(GOLDENS) || readdirSync(GOLDENS).length === 0) {
    mkdirSync(GOLDENS, { recursive: true });
    run('node', ['engine/render.mjs', 'stills', '2,5,8']);
    for (const f of readdirSync(path.join(PROJ, 'stills')).filter(f => f.startsWith('t'))) {
      copyFileSync(path.join(PROJ, 'stills', f), path.join(GOLDENS, f));
    }
    t.skip('goldens initialized — rerun to compare');
    return;
  }
  run('node', ['engine/render.mjs', 'stills', '2,5,8']);
  for (const g of readdirSync(GOLDENS)) {
    const now = readFileSync(path.join(PROJ, 'stills', g)).length;
    const ref = readFileSync(path.join(GOLDENS, g)).length;
    const drift = Math.abs(now - ref) / ref;
    assert.ok(drift < 0.15, `${g} size drifted ${(drift * 100).toFixed(1)}% — visual output changed; verify intentional, then refresh goldens`);
  }
});
