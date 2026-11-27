/**
 * @file verify.test.mjs — hard QC gates for the final mux output.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFinal } from '../../engine/lib/verify.mjs';

const good = () => ({
  probe: {
    streams: [
      { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, pix_fmt: 'yuv420p', color_range: 'tv', color_space: 'bt709', color_primaries: 'bt709', color_transfer: 'bt709', avg_frame_rate: '30/1', nb_frames: '90' },
      { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', channels: 1 },
    ],
    format: { duration: '3.0' },
  },
  boxScan: { moovBeforeMdat: true, order: ['ftyp', 'moov', 'mdat'] },
  targetDuration: 3,
  targetI: -15.5,
  verifyTP: -1.5,
  audio: { integrated: -15.5, truePeak: -2.0, bedGap: 22 },
});

const withProbe = (edit, base = good()) => ({ ...base, probe: { ...base.probe, streams: base.probe.streams.map(edit) } });

test('a file that meets every gate has no failures', () => {
  assert.deepEqual(evaluateFinal(good()).failures, []);
});

test('frame count must equal fps x duration within one frame', () => {
  const bad = { ...good(), probe: { ...good().probe, streams: good().probe.streams.map(s => (s.codec_type === 'video' ? { ...s, nb_frames: '95' } : s)) } };
  assert.match(evaluateFinal(bad).failures.join('\n'), /frame count is 95/);
  const off1 = withProbe(s => (s.codec_type === 'video' ? { ...s, nb_frames: '91' } : s));
  assert.deepEqual(evaluateFinal(off1).failures, []);
});

test('integrated loudness outside 0.25 LU fails', () => {
  const r = evaluateFinal({ ...good(), audio: { integrated: -15.1, truePeak: -2, bedGap: null } });
  assert.match(r.failures.join('\n'), /integrated loudness -15\.1 LUFS/);
});

test('true peak above the delivery ceiling fails', () => {
  const r = evaluateFinal({ ...good(), audio: { integrated: -15.5, truePeak: -1.0, bedGap: null } });
  assert.match(r.failures.join('\n'), /exceeds delivery ceiling/);
});

test('bed gap is enforced only when measured', () => {
  assert.match(evaluateFinal({ ...good(), audio: { integrated: -15.5, truePeak: -2, bedGap: 30 } }).failures.join('\n'), /outside target 20-24 dB/);
  assert.deepEqual(evaluateFinal({ ...good(), audio: { integrated: -15.5, truePeak: -2, bedGap: null } }).failures, []);
});

test('skipping audio verification does not evaluate loudness or true peak', () => {
  assert.deepEqual(evaluateFinal({ ...good(), audio: null }).failures, []);
});

test('an unmeasurable loudness value fails closed', () => {
  assert.match(evaluateFinal({ ...good(), audio: { integrated: NaN, truePeak: -2, bedGap: null } }).failures.join('\n'), /integrated loudness/);
});

test('stream shape, color, faststart, and duration are still enforced', () => {
  assert.match(evaluateFinal(withProbe(s => (s.codec_type === 'video' ? { ...s, width: 1920, height: 1080 } : s))).failures.join('\n'), /dimensions/);
  assert.match(evaluateFinal(withProbe(s => (s.codec_type === 'video' ? { ...s, color_space: 'bt601' } : s))).failures.join('\n'), /colorspace/);
  assert.match(evaluateFinal({ ...good(), boxScan: { moovBeforeMdat: false, order: ['ftyp', 'mdat', 'moov'] } }).failures.join('\n'), /moov is not before mdat/);
  assert.match(evaluateFinal({ ...good(), targetDuration: 5 }).failures.join('\n'), /format duration/);
});
