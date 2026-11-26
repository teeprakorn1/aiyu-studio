/**
 * @file engine-cli.test.mjs — fast CLI behavior tests for validation and publish dry-run wiring.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTalk } from '../../engine/lib/talk.mjs';
import { runProcess } from '../../engine/lib/ffmpeg.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(here, '..', '..');
const TMP = path.join(here, '.tmp-engine-cli');

function runNode(args, cwd = TMP) {
  return spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
}

before(() => {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  writeFileSync(path.join(TMP, 'package.json'), '{"name":"fixture","private":true}\n');
  writeFileSync(path.join(TMP, 'talk.js'), 'const TALK={"dur":3.2,"lines":[{"i":0,"t0":0,"dur":2,"txt":"x"}]};\n');
});
after(() => rmSync(TMP, { recursive: true, force: true }));

test('readTalk parses generated payload without eval', () => {
  const talk = readTalk(path.join(TMP, 'talk.js'));
  assert.equal(talk.dur, 3.2);
  assert.equal(talk.lines.length, 1);
  writeFileSync(path.join(TMP, "talk-escaped.js"), `const TALK={"dur":1,"lines":[{"txt":"x<\\/script>"}]};\n`);
  assert.equal(readTalk(path.join(TMP, 'talk-escaped.js')).lines[0].txt, 'x</script>');
});

test('publish dry-run derives ceil duration from talk.js and forwards encoding flags', () => {
  const r = runNode([path.join(REPO, 'engine/publish.mjs'), '--chunks=2', '--out=x', '--crf=28', '--preset=fast', '--dry-run']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /0-4s/);
  assert.match(r.stdout, /--crf=28/);
  assert.match(r.stdout, /--preset=fast/);
});

test('publish duration override is ceiled rather than rounded down', () => {
  const r = runNode([path.join(REPO, 'engine/publish.mjs'), '--duration=2.2', '--chunks=3', '--out=x', '--dry-run']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /0-3s/);
  assert.match(r.stdout, /\[0-1\] \[1-2\] \[2-3\]/);
});

test('publish rejects unknown flags loudly', () => {
  const r = runNode([path.join(REPO, 'engine/publish.mjs'), '--duration=2', '--chunks=1', '--bogus']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /unknown flag\(s\): --bogus/);
});

test('render rejects an invalid mode before browser launch', () => {
  const r = runNode([path.join(REPO, 'engine/render.mjs'), 'bogus']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /invalid mode/);
});

test('render validates output prefix and encoding flags before browser launch', () => {
  for (const [args, pattern] of [
    [['stills', '1', '--out=../x'], /--out must be a file-name prefix/],
    [['stills', '1', '--crf=99'], /--crf must be an integer/],
    [['stills', '1', '--preset=invalid'], /invalid x264 preset/],
  ]) {
    const r = runNode([path.join(REPO, 'engine/render.mjs'), ...args]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, pattern);
  }
});

test('render validates malformed time specs before browser launch', () => {
  for (const [args, pattern] of [
    [['video', '1,2,3'], /invalid video range/],
    [['video', '1,'], /invalid video range/],
    [['stills', ''], /invalid still timestamps/],
    [['stills', '1,,2'], /invalid still timestamps/],
  ]) {
    const r = runNode([path.join(REPO, 'engine/render.mjs'), ...args]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, pattern);
  }
});

test('publish rejects fractional and zero chunk counts', () => {
  for (const value of ['1.5', '0']) {
    const r = runNode([path.join(REPO, 'engine/publish.mjs'), `--chunks=${value}`, '--out=x', '--dry-run']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Invalid --chunks/);
  }
});

test('mux rejects unknown flags and invalid encoding values before file work', () => {
  const unknown = runNode([path.join(REPO, 'engine/mux.mjs'), '--concat=x', '--bogus']);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /unknown flag\(s\): --bogus/);
  for (const [args, pattern] of [
    [['--concat=x', '--crf=99'], /--crf must be an integer/],
    [['--concat=x', '--preset=invalid'], /invalid x264 preset/],
  ]) {
    const r = runNode([path.join(REPO, 'engine/mux.mjs'), ...args]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, pattern);
  }
});

test('runProcess propagates nonzero exit status and stderr tail', async () => {
  await assert.rejects(
    runProcess(process.execPath, ['-e', "process.stderr.write('boom');process.exit(3)"]),
    err => err.code === 3 && err.stderr.includes('boom')
  );
});

test('runProcess caps stderr capture', async () => {
  await assert.rejects(
    runProcess(process.execPath, ['-e', "process.stderr.write('x'.repeat(1100000));process.exit(3)"]),
    err => err.code === 3 && err.stderr.length <= 1024 * 1024
  );
});
