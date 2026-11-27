#!/usr/bin/env node
/**
 * @file mux.mjs — final mux/encode: concat silent chunks, fix full-range color to limited BT.709,
 * mix narration + looped music bed, two-pass loudness normalize, AAC, faststart MP4.
 * Every QC gate is a hard failure: the command exits non-zero unless the final file passes all of them.
 */

import { existsSync, mkdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs, assertKnownFlags, strFlag, numFlag } from './lib/cli-args.mjs';
import { runProcess, printCommand, ffprobeJson, parseRational } from './lib/ffmpeg.mjs';
import { scanMp4Boxes } from './lib/mp4-verify.mjs';
import { extractLoudnormJson, regionSpec, measureAstats, audioMixGraph, finalAudioGraph, fmtDurationValue } from './lib/loudness.mjs';
import { validateX264 } from './lib/encoding.mjs';
import { parseConcatList } from './lib/concat.mjs';
import { evaluateFinal } from './lib/verify.mjs';

/** project root — engine scripts always run from the project root (npm scripts guarantee it) */
const here = process.cwd();

function usage() {
  console.log(`Usage: node engine/mux.mjs --concat=out/v1concat.txt [options]

Required:
  --concat=<file>          FFmpeg concat-demuxer list of silent video chunks (entries are relative to the list file and must stay inside the project)

Options:
  --narration=narration.wav
  --bed=bed.wav
  --out=<mp4>              Default: final.mp4
  --bed-gain-db=3          Music bed gain before mixing. +3 dB measured as ~21-23 dB below speech.
  --voice-limit=0.35       Lookahead peak-limiter ceiling for narration (linear amplitude).
                           Needed because raw narration true peak is about +0.84 dBTP.
  --crf=19                 x264 CRF
  --preset=medium          x264 preset
  --loudness-i=-15.5       Integrated loudness target, LUFS
  --loudness-tp=-1.5       True-peak ceiling target, dBTP
  --loudness-lra=11        Loudness-range target, LU
  --verify-tp=<db>         Post-encode true-peak ceiling (default: loudness target)
  --pause=a-b              Verification pause region, seconds (omit = skip bed-gap check;
                           measure at a REAL narration pause in your film or the reading is meaningless)
  --speech=a-b             Verification speech region, seconds
  --skip-audio-verify      Do not run post-encode loudness/RMS measurements (loudness and true-peak gates are then not evaluated)
  --bed-duck               Sidechain-duck the bed under speech (opt-in); tunables --duck-threshold, --duck-ratio, --duck-attack, --duck-release
  --help

Hard gates: stream shape, faststart, duration, frames = fps x duration, integrated loudness within 0.25 LU of target,
true peak within the ceiling, and bed pause-vs-speech gap within 20-24 dB when measured. Any failure exits non-zero.

Example:
  node engine/mux.mjs --concat=out/v1concat.txt
`);
}

const { flags } = parseArgs(process.argv.slice(2));
assertKnownFlags(flags, ['concat','narration','bed','out','bed-gain-db','voice-limit','crf','preset','loudness-i','loudness-tp','loudness-lra','verify-tp','pause','speech','skip-audio-verify','bed-duck','duck-threshold','duck-ratio','duck-attack','duck-release','help'], 'mux.mjs');
if (flags.help) {
  usage();
  process.exit(0);
}

const concatArg = strFlag(flags, 'concat', undefined);
if (!concatArg) {
  usage();
  throw new Error('--concat is required');
}

const concatList = path.resolve(here, concatArg);
const narration = path.resolve(here, strFlag(flags, 'narration', 'narration.wav'));
const bed = path.resolve(here, strFlag(flags, 'bed', 'bed.wav'));
const output = path.resolve(here, strFlag(flags, 'out', 'final.mp4'));
const bedGainDb = numFlag(flags, 'bed-gain-db', 3, { min: -60, max: 24 });
const duck = flags['bed-duck'] !== undefined ? {
  threshold: numFlag(flags, 'duck-threshold', 0.02, { min: 0, max: 1 }),
  ratio: numFlag(flags, 'duck-ratio', 8, { min: 1, max: 20 }),
  attack: numFlag(flags, 'duck-attack', 25, { min: 1, max: 2000 }),
  release: numFlag(flags, 'duck-release', 500, { min: 1, max: 5000 }),
} : null;
if (duck) console.log(`mux: bed ducking ON (sidechain, ratio ${duck.ratio}:1, release ${duck.release}ms) — bed rises in pauses, dips under speech`);
const voiceLimit = numFlag(flags, 'voice-limit', 0.35, { min: 0.0625, max: 1 });
const { crf, preset } = validateX264(strFlag(flags, 'crf', '19'), strFlag(flags, 'preset', 'medium'));
const targetI = numFlag(flags, 'loudness-i', -15.5, { min: -70, max: -5 });
const targetTP = numFlag(flags, 'loudness-tp', -1.5, { min: -9, max: 0 });
const verifyTP = numFlag(flags, 'verify-tp', targetTP, { min: -20, max: 0 });
const targetLRA = numFlag(flags, 'loudness-lra', 11, { min: 1, max: 50 });
const pauseRegion = flags.pause !== undefined ? regionSpec(strFlag(flags, 'pause', '')) : null;
const speechRegion = flags.speech !== undefined ? regionSpec(strFlag(flags, 'speech', '')) : null;

for (const [label, file] of [['concat list', concatList], ['narration', narration], ['bed', bed]]) {
  if (!existsSync(file)) throw new Error(`${label} not found: ${file}`);
}

const chunks = parseConcatList(readFileSync(concatList, 'utf8'), path.dirname(concatList), here);
console.log(`mux: concat list ${concatList}`);
console.log(`mux: ${chunks.length} video chunk(s)`);

let videoDuration = 0;
for (const file of chunks) {
  if (!existsSync(file)) throw new Error(`concat chunk missing: ${file}`);
  if (!statSync(file).size) throw new Error(`concat chunk is empty: ${file}`);
  const probe = await ffprobeJson(file);
  const v = probe.streams?.find(s => s.codec_type === 'video');
  if (!v) throw new Error(`no video stream in chunk: ${file}`);
  const fps = parseRational(v.avg_frame_rate || v.r_frame_rate);
  const frames = Number(v.nb_frames);
  const duration = Number.isFinite(frames) && frames > 0 && Number.isFinite(fps) && fps > 0
    ? frames / fps
    : Number(v.duration || probe.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`could not determine duration for chunk: ${file}`);
  if (v.width !== 1080 || v.height !== 1920 || Math.abs(fps - 30) > 0.001) throw new Error(`chunk ${path.basename(file)} is ${v.width}x${v.height}@${fps}fps; expected 1080x1920@30 — re-render it`);
  videoDuration += duration;
  console.log(`  ${path.basename(file)}: ${duration.toFixed(6)}s, ${frames || '?'} frames, ${v.width}x${v.height}, fps=${fps}, input_pix_fmt=${v.pix_fmt}, input_range=${v.color_range}`);
}

const narrationProbe = await ffprobeJson(narration);
const narrationDuration = Number(narrationProbe.format?.duration);
if (!Number.isFinite(narrationDuration)) throw new Error('could not determine narration duration');
if (narrationDuration > videoDuration + 0.050) {
  throw new Error(`refusing to truncate narration: narration=${narrationDuration.toFixed(3)}s but video=${videoDuration.toFixed(3)}s`);
}

const targetDuration = videoDuration;
const durText = fmtDurationValue(targetDuration);
console.log(`mux: target duration ${targetDuration.toFixed(6)}s; narration ${narrationDuration.toFixed(3)}s (padding ${(targetDuration - narrationDuration).toFixed(3)}s, no truncation)`);
console.log(`mux: bed gain ${bedGainDb} dB; voice lookahead limiter ceiling ${voiceLimit}`);

mkdirSync(path.dirname(output), { recursive: true });

// PASS 1: measure the exact pre-normalization narration+bed mix.
const pass1Graph = `${audioMixGraph({ duration: targetDuration, voiceLimit, bedGainDb, firstPass: true, duck })};[premix]loudnorm=I=${targetI}:TP=${targetTP}:LRA=${targetLRA}:print_format=json[m]`;
const pass1Args = [
  '-hide_banner', '-nostats',
  '-i', narration,
  '-stream_loop', '-1', '-i', bed,
  '-filter_complex', pass1Graph,
  '-map', '[m]',
  '-f', 'null', '-',
];
console.log('\nmux loudnorm pass 1 command:');
console.log(printCommand('ffmpeg', pass1Args));
const pass1 = await runProcess('ffmpeg', pass1Args);
const measured = extractLoudnormJson(pass1.stderr + pass1.stdout);
console.log('mux loudnorm pass 1 measurements:', JSON.stringify(measured, null, 2));

const loudnormSecond = {
  i: targetI,
  tp: targetTP,
  lra: targetLRA,
  measured_I: measured.input_i,
  measured_TP: measured.input_tp,
  measured_LRA: measured.input_lra,
  measured_thresh: measured.input_thresh,
  offset: measured.target_offset,
};

const videoGraph = '[0:v]scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709[v]';
const audioGraph = finalAudioGraph({ duration: targetDuration, voiceLimit, bedGainDb, loudnorm: loudnormSecond, duck });
const finalGraph = `${videoGraph};${audioGraph}`;

// PASS 2 + video encode/mux.
const finalArgs = [
  '-y', '-hide_banner',
  '-f', 'concat', '-i', concatList,
  '-i', narration,
  '-stream_loop', '-1', '-i', bed,
  '-filter_complex', finalGraph,
  '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-crf', crf, '-preset', preset,
  '-pix_fmt', 'yuv420p',
  '-color_range', 'tv',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-c:a', 'aac', '-b:a', '96k', '-ar', '48000', '-ac', '1',
  '-movflags', '+faststart',
  '-t', durText,
  output,
];
console.log('\nmux final encode command:');
console.log(printCommand('ffmpeg', finalArgs));
await runProcess('ffmpeg', finalArgs, { progress: true });

if (!existsSync(output) || !statSync(output).size) throw new Error(`encode completed but output missing/empty: ${output}`);
console.log(`\nmux: wrote ${output} (${statSync(output).size} bytes)`);

const probe = await ffprobeJson(output);
const boxScan = scanMp4Boxes(output);
const v = probe.streams?.find(s => s.codec_type === 'video');
const a = probe.streams?.find(s => s.codec_type === 'audio');
console.log('\nffprobe verification:');
console.log(JSON.stringify({
  format: {
    duration: probe.format?.duration,
    size: probe.format?.size,
    bit_rate: probe.format?.bit_rate,
  },
  video: v && {
    codec_name: v.codec_name,
    profile: v.profile,
    width: v.width,
    height: v.height,
    pix_fmt: v.pix_fmt,
    color_range: v.color_range,
    color_space: v.color_space,
    color_primaries: v.color_primaries,
    color_transfer: v.color_transfer,
    avg_frame_rate: v.avg_frame_rate,
    nb_frames: v.nb_frames,
    duration: v.duration,
    bit_rate: v.bit_rate,
  },
  audio: a && {
    codec_name: a.codec_name,
    profile: a.profile,
    sample_rate: a.sample_rate,
    channels: a.channels,
    channel_layout: a.channel_layout,
    duration: a.duration,
    bit_rate: a.bit_rate,
  },
  faststart: boxScan,
}, null, 2));

let audio = null;
if (flags['skip-audio-verify'] !== undefined) {
  console.log('\nmux: audio verification skipped (--skip-audio-verify) — loudness and true-peak gates not evaluated');
} else {
  const measureArgs = ['-hide_banner', '-nostats', '-i', output, '-map', '0:a:0', '-af', `loudnorm=I=${targetI}:TP=${targetTP}:LRA=${targetLRA}:print_format=json`, '-f', 'null', '-'];
  console.log('\npost-encode loudness measurement command:');
  console.log(printCommand('ffmpeg', measureArgs));
  const lm = await runProcess('ffmpeg', measureArgs);
  const loudnessMeasured = extractLoudnormJson(lm.stderr + lm.stdout);
  const hasRegions = pauseRegion && speechRegion;
  let pauseStats = null;
  let speechStats = null;
  if (hasRegions) {
    pauseStats = await measureAstats(output, pauseRegion);
    speechStats = await measureAstats(output, speechRegion);
  } else {
    console.log('\nbed pause-vs-speech check skipped (pass --pause=a-b --speech=c-d at real regions of your film to enable it)');
  }
  const bedGap = hasRegions ? speechStats.rms - pauseStats.rms : null;
  audio = { integrated: Number(loudnessMeasured.input_i), truePeak: Number(loudnessMeasured.input_tp), bedGap };

  console.log('\naudio measurements:');
  console.log(JSON.stringify({
    integrated_lufs: audio.integrated,
    true_peak_dbtp: audio.truePeak,
    lra_lu: Number(loudnessMeasured.input_lra),
    threshold_lufs: Number(loudnessMeasured.input_thresh),
    pause_region: pauseStats && { ...pauseRegion, rms_db: pauseStats.rms, peak_db: pauseStats.peak },
    speech_region: speechStats && { ...speechRegion, rms_db: speechStats.rms, peak_db: speechStats.peak },
    bed_below_speech_db: bedGap,
  }, null, 2));
}

const { failures } = evaluateFinal({ probe, boxScan, targetDuration, targetI, verifyTP, audio });
if (failures.length) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  throw new Error('mux verification failed');
}
console.log('\nmux verification: PASS');
