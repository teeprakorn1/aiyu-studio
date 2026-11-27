/**
 * @file mix-real.test.mjs — real-audio mix path: vo/ voice files → npm run mix → talk.js + narration.wav.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, npmInstall, npmRun, PY } from '../helpers/proc.mjs';
import { readTalk } from '../../engine/lib/talk.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(here, '..', '..');
const PROJ = path.join(here, '.tmp-mix-real');
const VO = ['n000-002.wav', 'c003_H.wav', 'n004-005.wav', 'c006_G.wav', 'n007-009.wav'];
const LEAD = 0.5;
const TRIM_PAD = 0.06;
const TEMPO = 1.15;
let mixOut;

before(function () {
  rmSync(PROJ, { recursive: true, force: true });
  run(PY, [path.join(REPO, 'new-project.py'), PROJ], REPO);
  npmInstall(PROJ);
  mkdirSync(path.join(PROJ, 'vo'), { recursive: true });
  VO.forEach((name, i) => run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `sine=frequency=${440 + 110 * i}:duration=1`,
    '-af', `adelay=${LEAD * 1000},apad=pad_dur=0.3`, '-ar', '24000', '-ac', '1', path.join(PROJ, 'vo', name)], PROJ));
  writeFileSync(path.join(PROJ, 'story', 'wordtimes.json'), JSON.stringify({ 0: [['alpha', LEAD, LEAD + 0.3]] }));
  mixOut = npmRun('mix', [], PROJ);
});

after(() => { if (!process.env.AIYU_KEEP_WORKSPACES) rmSync(PROJ, { recursive: true, force: true }); });

test('npm run mix uses the real voice files and merges karaoke timing', () => {
  assert.match(mixOut, /real mode: all voice files present/);
  assert.match(mixOut, /karaoke timing merged into/);
});

test('talk.js carries real envelopes and word timing relative to the trimmed audio', () => {
  const talk = readTalk(path.join(PROJ, 'talk.js'));
  assert.equal(talk.lines.length, 10);
  assert.ok(talk.lines.some(l => l.env.some(v => v > 0)), 'envelopes are all zero');
  const word = talk.lines[0].words?.[0];
  assert.ok(word, 'line 0 has no word timing');
  assert.ok(Math.abs(word.t0 - TRIM_PAD / TEMPO) < 0.03, `word starts at ${word.t0}, expected about ${TRIM_PAD / TEMPO}`);
});

test('narration ends where the last line ends, with no trailing gap', () => {
  const talk = readTalk(path.join(PROJ, 'talk.js'));
  const narration = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(PROJ, 'narration.wav')], PROJ));
  const last = talk.lines.at(-1);
  assert.ok(Math.abs(narration - (last.t0 + last.dur)) < 0.03, `narration ${narration}s vs last line end ${last.t0 + last.dur}s`);
  assert.ok(narration < talk.dur);
});
