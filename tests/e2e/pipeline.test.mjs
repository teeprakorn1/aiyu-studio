/**
 * @file pipeline.test.mjs — end-to-end pipeline: scaffold → stub mix → stills → check-subs
 * → parallel publish → mux with synthetic audio. The regression net for the whole system.
 * Requires: ffmpeg, a browser (Chrome or playwright chromium). Run time: minutes.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(here, '..', '..');
const PROJ = path.join(here, '.tmp-project');
const PY = process.env.PYTHON || 'py';
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(cmd, args, cwd = PROJ) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function npmRun(script, args = []) {
  // bypass npm script shell-chain quirks by invoking the underlying commands directly
  return run('node', script, args);
}

before(function () {
  rmSync(PROJ, { recursive: true, force: true });
  run(PY, [path.join(REPO, 'new-project.py'), PROJ], REPO);
  execFileSync(NPM, ['install', '--no-fund', '--no-audit', '--silent'], { cwd: PROJ, shell: true, stdio: 'ignore' });
});

after(() => { rmSync(PROJ, { recursive: true, force: true }); });

test('scaffold produces the 3-layer structure', () => {
  for (const p of ['engine/lib/cli-args.mjs', 'core/base.js', 'features/character.js', 'story/style.js', 'story/dialogue.txt', 'index.html', 'preview.html']) {
    assert.ok(existsSync(path.join(PROJ, p)), `missing ${p}`);
  }
});

test('stub mix produces valid talk.js', () => {
  run(PY, ['engine/mix-studio.py', '--stub']);
  const src = readFileSync(path.join(PROJ, 'talk.js'), 'utf8');
  const talk = JSON.parse(src.replace(/^const TALK=/, '').replace(/;\s*$/, ''));
  assert.ok(talk.dur > 10, 'dur sane');
  assert.ok(talk.lines.length > 0);
  assert.equal(typeof talk.lines[0].t0, 'number');
});

test('stills render non-black frames', () => {
  run('node', ['engine/render.mjs', 'stills', '2,7']);
  const sheet = path.join(PROJ, 'stills', 'sheet.jpg');
  assert.ok(existsSync(sheet));
  const size = readFileSync(sheet).length;
  assert.ok(size > 20000, `sheet.jpg suspiciously small: ${size}`);
});

test('subtitle acceptance passes', () => {
  const out = run('node', ['engine/measure-subs.mjs']);
  assert.match(out, /PASS/);
});

test('parallel publish renders disjoint chunks', () => {
  const out = run('node', ['engine/publish.mjs', '--duration=4', '--chunks=2', '--out=e2e', '--crf=28']);
  assert.ok(existsSync(path.join(PROJ, 'out', 'e2e_0-2.mp4')));
  assert.ok(existsSync(path.join(PROJ, 'out', 'e2e_2-4.mp4')));
  assert.ok(existsSync(path.join(PROJ, 'out', 'e2econcat.txt')));
});

test('mux full pipeline self-verifies (loudness + faststart + shape)', () => {
  run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3.5', '-ar', '24000', '-ac', '1', 'narration.wav']);
  run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=3.5', '-ar', '48000', '-ac', '1', 'bed.wav']);
  const out = run('node', ['engine/mux.mjs', '--concat=out/e2econcat.txt', '--out=final-e2e.mp4']);
  assert.match(out, /verification: PASS/);
  assert.ok(existsSync(path.join(PROJ, 'final-e2e.mp4')));
});

test('rendered chunk has correct shape per ffprobe', () => {
  const out = run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', 'out/e2e_0-2.mp4']);
  const probe = JSON.parse(out);
  const v = probe.streams[0];
  assert.equal(v.width, 1080);
  assert.equal(v.height, 1920);
});
