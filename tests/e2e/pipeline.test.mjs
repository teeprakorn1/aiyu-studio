/**
 * @file pipeline.test.mjs — end-to-end pipeline: scaffold → npm stub → npm stills → npm check-subs
 * → npm publish → npm mux with synthetic audio. Tests the stable user interface, not internal shortcuts.
 * Requires: ffmpeg, a browser (Chrome or playwright chromium). Run time: minutes.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, readFileSync } from 'node:fs';
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

after(() => { rmSync(PROJ, { recursive: true, force: true }); });

test('scaffold produces the 3-layer structure', () => {
  for (const p of ['engine/lib/cli-args.mjs', 'core/base.js', 'core/registry.js', 'features/character.js', 'story/style.js', 'story/dialogue.txt', 'index.html', 'preview.html', 'package-lock.json']) {
    assert.ok(existsSync(path.join(PROJ, p)), `missing ${p}`);
  }
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
