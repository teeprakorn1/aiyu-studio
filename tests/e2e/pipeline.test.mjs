/**
 * @file pipeline.test.mjs — end-to-end pipeline: scaffold → npm stub → npm stills → npm check-subs
 * → npm publish → npm mux with synthetic audio. Tests the stable user interface, not internal shortcuts.
 * Requires: ffmpeg, a browser (Chrome or playwright chromium). Run time: minutes.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, npmInstall, npmRun, PY } from '../helpers/proc.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(here, '..', '..');
const PROJ = path.join(here, '.tmp-project');

before(function () {
  rmSync(PROJ, { recursive: true, force: true });
  run(PY, [path.join(REPO, 'new-project.py'), PROJ], REPO);
  npmInstall(PROJ);
});

after(() => { if (!process.env.AIYU_KEEP_WORKSPACES) rmSync(PROJ, { recursive: true, force: true }); });

const walk = (dir, base = dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  if (e.name === '__pycache__') return [];
  const full = path.join(dir, e.name);
  return e.isDirectory() ? walk(full, base) : [path.relative(base, full).split(path.sep).join('/')];
});

test('scaffold copies every shipped template file, the engine tree, and the root .gitignore', () => {
  const shipped = [...walk(path.join(REPO, 'template')), ...walk(path.join(REPO, 'engine')).map(f => `engine/${f}`)];
  assert.deepEqual(shipped.filter(f => !existsSync(path.join(PROJ, f))), []);
  for (const d of ['vo', 'assets/fonts', 'skills']) assert.ok(existsSync(path.join(PROJ, d)), `missing ${d}/`);
  assert.ok(existsSync(path.join(PROJ, '.gitignore')), 'missing .gitignore');
  for (const d of ['tests', 'docs', 'examples']) assert.ok(!existsSync(path.join(PROJ, d)), `${d}/ must not be scaffolded`);
});

test('npm run stub produces valid talk.js', () => {
  npmRun('stub', [], PROJ);
  const src = readFileSync(path.join(PROJ, 'talk.js'), 'utf8');
  const talk = JSON.parse(src.replace(/^const TALK=/, '').replace(/;\s*$/, ''));
  assert.ok(talk.dur > 10, 'dur sane');
  assert.ok(talk.lines.length > 0);
  assert.equal(typeof talk.lines[0].t0, 'number');
});

test('npm run stills renders non-black frames', () => {
  npmRun('stills', ['2,7'], PROJ);
  const sheet = path.join(PROJ, 'stills', 'sheet.jpg');
  assert.ok(existsSync(sheet));
  const size = readFileSync(sheet).length;
  assert.ok(size > 20000, `sheet.jpg suspiciously small: ${size}`);
});

test('npm run check-subs passes subtitle acceptance', () => {
  const out = npmRun('check-subs', [], PROJ);
  assert.match(out, /PASS/);
});

test('npm run publish renders disjoint chunks through the user interface', () => {
  npmRun('publish', ['--duration=4', '--chunks=2', '--out=e2e', '--crf=28'], PROJ);
  assert.ok(existsSync(path.join(PROJ, 'out', 'e2e_0-2.mp4')));
  assert.ok(existsSync(path.join(PROJ, 'out', 'e2e_2-4.mp4')));
  assert.ok(existsSync(path.join(PROJ, 'out', 'e2econcat.txt')));
});

test('publish and render refuse to overwrite rendered versions', () => {
  assert.throws(() => npmRun('publish', ['--duration=4', '--chunks=2', '--out=e2e', '--crf=28'], PROJ), /already exists/);
  const r = spawnSync(process.execPath, ['engine/render.mjs', 'video', '0,2', '--out=e2e'], { cwd: PROJ, encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /already exists/);
});

test('render rejects reversed video ranges and never claims success', () => {
  const r = spawnSync(process.execPath, ['engine/render.mjs', 'video', '3,2'], { cwd: PROJ, encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /invalid video range/);
  assert.doesNotMatch(r.stdout + r.stderr, /video ok/);
});

test('npm run mux full pipeline self-verifies (loudness + faststart + shape)', () => {
  run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3.5', '-ar', '24000', '-ac', '1', 'narration.wav'], PROJ);
  run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=3.5', '-ar', '48000', '-ac', '1', 'bed.wav'], PROJ);
  const out = npmRun('mux', ['--concat=out/e2econcat.txt', '--out=final-e2e.mp4'], PROJ);
  assert.match(out, /verification: PASS/);
  assert.ok(existsSync(path.join(PROJ, 'final-e2e.mp4')));
});

test('rendered chunk has correct shape per ffprobe', () => {
  const out = run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', 'out/e2e_0-2.mp4'], PROJ);
  const probe = JSON.parse(out);
  const v = probe.streams[0];
  assert.equal(v.width, 1080);
  assert.equal(v.height, 1920);
});
