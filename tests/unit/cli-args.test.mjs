/**
 * @file cli-args.test.mjs — unit tests for engine/lib/cli-args.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../../engine/lib/cli-args.mjs';

test('parses --key=value form', () => {
  const { flags } = parseArgs(['--duration=95', '--chunks=6']);
  assert.equal(flags.duration, '95');
  assert.equal(flags.chunks, '6');
});

test('parses --key value form', () => {
  const { flags } = parseArgs(['--duration', '95']);
  assert.equal(flags.duration, '95');
});

test('boolean flags become true', () => {
  const { flags } = parseArgs(['--dry-run', '--help']);
  assert.equal(flags['dry-run'], true);
  assert.equal(flags.help, true);
});

test('positionals are collected in order and never eaten as values', () => {
  const { flags, pos } = parseArgs(['stills', '1,5,9', '--page=index.html', 'video']);
  assert.deepEqual(pos, ['stills', '1,5,9', 'video']);
  assert.equal(flags.page, 'index.html');
});

test('--key value consumes the next token so it is not positional', () => {
  const { pos, flags } = parseArgs(['stills', '--crf', '22']);
  assert.equal(flags.crf, '22');
  assert.deepEqual(pos, ['stills']);
});

test('empty argv yields empty results', () => {
  const { flags, pos } = parseArgs([]);
  assert.deepEqual(flags, {});
  assert.deepEqual(pos, []);
});
