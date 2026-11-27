/**
 * @file cli-args.test.mjs — unit tests for engine/lib/cli-args.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, strFlag, numFlag, flagValue } from '../../engine/lib/cli-args.mjs';

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

test('flagValue and strFlag reject bare flags that need a value', () => {
  assert.throws(() => flagValue({ out: true }, 'out'), /--out requires a value/);
  assert.throws(() => strFlag({ out: true }, 'out', 'v1'), /--out requires a value/);
  assert.equal(strFlag({}, 'out', 'v1'), 'v1');
  assert.equal(strFlag({ out: 'v2' }, 'out', 'v1'), 'v2');
});

test('numFlag enforces ranges, integers, and numeric text', () => {
  assert.equal(numFlag({}, 'chunks', 6, { min: 1, max: 64, integer: true }), 6);
  assert.equal(numFlag({ verify: '-2' }, 'verify', -1.5, { min: -20, max: 0 }), -2);
  assert.throws(() => numFlag({ verify: true }, 'verify', -1.5, { min: -20, max: 0 }), /--verify requires a value/);
  assert.throws(() => numFlag({ chunks: '1.5' }, 'chunks', 6, { min: 1, max: 64, integer: true }), /must be an integer/);
  assert.throws(() => numFlag({ x: '' }, 'x', 1), /must be a number/);
  assert.throws(() => numFlag({ x: '99' }, 'x', 1, { min: 0, max: 10 }), /range 0\.\.10/);
});
