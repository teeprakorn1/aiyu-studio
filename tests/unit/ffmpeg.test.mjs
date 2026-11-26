/**
 * @file ffmpeg.test.mjs — scanMp4Boxes against a real ffmpeg-generated fixture.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanMp4Boxes } from '../../engine/lib/mp4-verify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = path.join(here, '.tmp-ffmpeg');
const FASTSTART = path.join(TMP, 'fast.mp4');
const SLOWSTART = path.join(TMP, 'slow.mp4');

before(() => {
  mkdirSync(TMP, { recursive: true });
  const base = ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=black:size=64x64:duration=0.5:rate=5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p'];
  execFileSync('ffmpeg', [...base, '-movflags', '+faststart', FASTSTART]);
  execFileSync('ffmpeg', [...base, SLOWSTART]);
});

after(() => { rmSync(TMP, { recursive: true, force: true }); });

test('faststart mp4 has moov before mdat', () => {
  const r = scanMp4Boxes(FASTSTART);
  assert.equal(r.moovBeforeMdat, true);
  assert.ok(r.order.includes('ftyp'));
});

test('default mp4 has mdat before moov (moovBeforeMdat false)', () => {
  const r = scanMp4Boxes(SLOWSTART);
  assert.ok(r.moovIndex >= 0 && r.mdatIndex >= 0);
  assert.equal(r.moovBeforeMdat, false);
});
