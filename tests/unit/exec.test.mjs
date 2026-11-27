/**
 * @file exec.test.mjs — executables resolve from PATH only; the current directory and relative PATH entries are never searched.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, copyFileSync, writeFileSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveExecutable } from '../../engine/lib/exec.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(here, '.tmp-exec');
const NAME = 'aiyu-fake-tool';
const EXE = process.platform === 'win32' ? `${NAME}.exe` : NAME;

before(() => {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  if (process.platform === 'win32') copyFileSync(process.execPath, path.join(DIR, EXE));
  else {
    writeFileSync(path.join(DIR, EXE), '#!/bin/sh\necho ok\n');
    chmodSync(path.join(DIR, EXE), 0o755);
  }
});

after(() => rmSync(DIR, { recursive: true, force: true }));

test('resolves a bare name from a PATH entry', () => {
  assert.equal(resolveExecutable(NAME, { PATH: DIR }), path.join(DIR, EXE));
});

test('does not search the current directory or relative PATH entries', () => {
  const rel = path.relative(process.cwd(), DIR);
  assert.throws(() => resolveExecutable(NAME, { PATH: rel }), /not found on PATH/);
  assert.throws(() => resolveExecutable(NAME, { PATH: '' }), /not found on PATH/);
});

test('absolute executable paths are accepted only when they exist', () => {
  assert.equal(resolveExecutable(path.join(DIR, EXE), {}), path.join(DIR, EXE));
  assert.throws(() => resolveExecutable(path.join(DIR, 'missing'), {}), /not an executable file/);
});

test('names with directory separators are rejected', () => {
  assert.throws(() => resolveExecutable('bin/ffmpeg', { PATH: DIR }), /bare command name/);
});
