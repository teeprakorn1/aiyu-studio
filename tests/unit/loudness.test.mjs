/**
 * @file loudness.test.mjs — unit tests for engine/lib/loudness.mjs + ffmpeg.mjs pure helpers
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLoudnormJson, regionSpec, fmtDurationValue, audioMixGraph, finalAudioGraph } from '../../engine/lib/loudness.mjs';
import { parseRational, shellQuote } from '../../engine/lib/ffmpeg.mjs';
import { makeBoundaries, escapeConcatPath } from '../../engine/lib/chunking.mjs';

// ---------- loudness ----------

test('extractLoudnormJson parses measurement buried in ffmpeg noise', () => {
  const noise = 'frame= 100 fps=30\n{ "input_i" : "-20.5", "input_tp" : "-3.2",\n"input_lra" : "7.1" }\ntrailing junk';
  const m = extractLoudnormJson(noise);
  assert.equal(m.input_i, '-20.5');
  assert.equal(m.input_lra, '7.1');
});

test('extractLoudnormJson throws with tail context when JSON missing', () => {
  assert.throws(() => extractLoudnormJson('no json here'), /Could not find loudnorm JSON/);
});

test('regionSpec parses START-END with whitespace variants', () => {
  assert.deepEqual(regionSpec('10-25'), { start: 10, end: 25 });
  assert.deepEqual(regionSpec(' 10.5 - 25.25 '), { start: 10.5, end: 25.25 });
});

test('regionSpec rejects malformed input', () => {
  assert.throws(() => regionSpec('abc'), /Invalid time region/);
});

test('fmtDurationValue trims floating noise', () => {
  assert.equal(fmtDurationValue(4.000000001), '4');
  assert.equal(fmtDurationValue(19.23), '19.23');
});

test('audioMixGraph first pass emits [premix], final emits [mix]', () => {
  const cfg = { duration: 10, voiceLimit: 0.35, bedGainDb: 3 };
  assert.match(audioMixGraph({ ...cfg, firstPass: true }), /\[premix\]$/);
  assert.match(audioMixGraph({ ...cfg, firstPass: false }), /\[mix\]$/);
});

test('audioMixGraph includes voice limiter and bed gain', () => {
  const g = audioMixGraph({ duration: 10, voiceLimit: 0.35, bedGainDb: 3, firstPass: true });
  assert.match(g, /alimiter=limit=0\.35/);
  assert.match(g, /volume=3dB/);
  assert.match(g, /amix=inputs=2:duration=first/);
});

test('finalAudioGraph carries loudnorm linear correction params', () => {
  const ln = { i: -15.5, tp: -1.5, lra: 11, measured_I: -20, measured_TP: -3, measured_LRA: 7, measured_thresh: -30, offset: 0.5 };
  const g = finalAudioGraph({ duration: 10, voiceLimit: 0.35, bedGainDb: 3, loudnorm: ln });
  assert.match(g, /loudnorm=I=-15\.5:TP=-1\.5:LRA=11/);
  assert.match(g, /measured_I=-20/);
  assert.match(g, /linear=true/);
  assert.match(g, /\[a\]$/);
});

// ---------- ffmpeg pure helpers ----------

test('parseRational handles ffmpeg fractional rates', () => {
  assert.ok(Math.abs(parseRational('30000/1001') - 29.97) < 0.001);
  assert.equal(parseRational('30'), 30);
  assert.ok(Number.isNaN(parseRational(undefined)));
});

test('shellQuote passes safe tokens, quotes dangerous ones', () => {
  assert.equal(shellQuote('out/v1_0-5.mp4'), 'out/v1_0-5.mp4');
  assert.equal(shellQuote('my file.mp4'), "'my file.mp4'");
});

// ---------- chunking ----------

test('makeBoundaries covers [0,end] contiguously with integer seconds', () => {
  for (const [end, chunks] of [[95, 6], [10, 3], [4, 2], [7, 7]]) {
    const b = makeBoundaries(end, chunks);
    assert.equal(b[0], 0);
    assert.equal(b[b.length - 1], end);
    assert.equal(b.length, chunks + 1);
    for (let i = 1; i < b.length; i++) {
      assert.ok(b[i] > b[i - 1], `strictly increasing at ${i}: ${b}`);
      assert.ok(Number.isInteger(b[i]));
    }
  }
});

test('escapeConcatPath escapes single quotes ffmpeg-style', () => {
  assert.equal(escapeConcatPath("it's.mp4"), "it'\\''s.mp4");
});
