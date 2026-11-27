/**
 * @file containment.test.mjs — user-supplied paths and concat entries must stay inside the project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveInside } from '../../engine/lib/paths.mjs';
import { parseConcatList } from '../../engine/lib/concat.mjs';

const root = path.resolve('fixture-root');
const listDir = path.join(root, 'out');

test('resolveInside keeps relative paths under the root', () => {
  assert.equal(resolveInside(root, 'index.html'), path.join(root, 'index.html'));
  assert.equal(resolveInside(root, path.join('sub', 'page.html')), path.join(root, 'sub', 'page.html'));
});

test('resolveInside rejects escapes', () => {
  assert.throws(() => resolveInside(root, '../outside.html'), /escapes the project folder/);
  assert.throws(() => resolveInside(root, path.resolve(root, '..', 'x')), /escapes the project folder/);
});

test('concat entries resolve relative to the list file', () => {
  const files = parseConcatList("file 'v1_0-2.mp4'\nfile 'part/x.mp4'\n", listDir, root);
  assert.deepEqual(files, [path.join(listDir, 'v1_0-2.mp4'), path.join(listDir, 'part', 'x.mp4')]);
});

test('concat quoting and escaped apostrophes are decoded', () => {
  assert.deepEqual(parseConcatList("file 'it'\\''s.mp4'\n", listDir, root), [path.join(listDir, "it's.mp4")]);
});

test('concat entries that are absolute or escape the project are rejected', () => {
  assert.throws(() => parseConcatList(`file '${path.resolve(root, 'abs.mp4')}'\n`, listDir, root), /relative to the list file/);
  assert.throws(() => parseConcatList("file '../../escape.mp4'\n", listDir, root), /escapes the project folder/);
});

test('unsupported or empty concat lists are rejected', () => {
  assert.throws(() => parseConcatList('duration 1\n', listDir, root), /unsupported concat-list line/);
  assert.throws(() => parseConcatList('# only a comment\n', listDir, root), /no file entries/);
});
