/**
 * @file chunking.test.mjs — chunk boundaries, chunk job planning, and render time/name helpers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { makeBoundaries, planChunkJobs, escapeConcatPath } from '../../engine/lib/chunking.mjs';
import { parseStillTimes, parseVideoRange, outputNameFor } from '../../engine/lib/render-spec.mjs';

test('boundaries cover [0, end] without gaps and never shrink below one second', () => {
  assert.deepEqual(makeBoundaries(10, 3), [0, 3, 7, 10]);
  assert.deepEqual(makeBoundaries(3, 3), [0, 1, 2, 3]);
});

test('planChunkJobs produces contiguous ranges, output names, and forwarded flags', () => {
  const root = path.resolve('fixture-root');
  const jobs = planChunkJobs({ end: 4, chunks: 2, outPrefix: 'v1', root, page: 'index.html', browser: undefined, crf: '28', preset: 'fast', force: false, renderScript: 'render.mjs' });
  assert.deepEqual(jobs.map(j => j.range), ['0,2', '2,4']);
  assert.equal(path.basename(jobs[1].output), 'v1_2-4.mp4');
  assert.equal(jobs[0].frames, 60);
  assert.deepEqual(jobs[0].args, ['render.mjs', 'video', '0,2', '--page=index.html', '--out=v1', '--crf=28', '--preset=fast']);
  const forced = planChunkJobs({ end: 2, chunks: 1, outPrefix: 'v1', root, page: 'p.html', browser: '/b', crf: '20', preset: 'medium', force: true, renderScript: 'r.mjs' });
  assert.deepEqual(forced[0].args.slice(-2), ['--browser=/b', '--force']);
});

test('still and video specs validate input', () => {
  assert.deepEqual(parseStillTimes('1,5.5'), [1, 5.5]);
  assert.throws(() => parseStillTimes('1,,2'), /invalid still timestamps/);
  assert.deepEqual(parseVideoRange('0,100'), [0, 100]);
  assert.throws(() => parseVideoRange('3,2'), /invalid video range/);
});

test('output names follow the chunk convention', () => {
  assert.equal(outputNameFor('v1', '0,100'), 'v1_0-100.mp4');
  assert.equal(outputNameFor('final'), 'final.mp4');
});

test('concat paths escape single quotes', () => {
  assert.equal(escapeConcatPath("it's.mp4"), "it'\\''s.mp4");
});
