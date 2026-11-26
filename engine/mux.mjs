#!/usr/bin/env node
/**
 * @file mux.mjs — final mux/encode: concat silent chunks, fix full-range color to limited BT.709,
 * mix narration + looped music bed, two-pass loudness normalize, AAC, faststart MP4.
 */

import { existsSync, mkdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from './lib/cli-args.mjs';
import { runProcess, printCommand, ffprobeJson, parseRational } from './lib/ffmpeg.mjs';
import { scanMp4Boxes } from './lib/mp4-verify.mjs';
import { extractLoudnormJson, regionSpec, measureAstats, audioMixGraph, finalAudioGraph, fmtDurationValue } from './lib/loudness.mjs';

/** project root — engine scripts always run from the project root (npm scripts guarantee it) */
const here = process.cwd();

function usage() {
  console.log(`Usage: node engine/mux.mjs --concat=out/v1concat.txt [options]

Required:
  --concat=<file>          FFmpeg concat-demuxer list of silent video chunks

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
  --pause=a-b              Verification pause region, seconds (omit = skip bed-gap check;
                           measure at a REAL narration pause in your film or the reading is meaningless)
  --speech=a-b             Verification speech region, seconds
  --skip-audio-verify      Do not run post-encode loudness/RMS measurements
  --help

Example:
  node engine/mux.mjs --concat=out/v1concat.txt
`);
}

function parseConcatList(listPath) {
  const dir = path.dirname(listPath);
  const lines = readFileSync(listPath, 'utf8').split(/\r?\n/);
  const files = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^file\s+(.+)$/i);
    if (!m) throw new Error(`Unsupported concat-list line in ${listPath}: ${line}`);
    let p = m[1].trim();
    if ((p.startsWith("'") && p.endsWith("'")) || (p.startsWith('"') && p.endsWith('"'))) p = p.slice(1, -1);
    p = p.replace(/'\\''/g, "'");
    files.push(path.resolve(dir, p));
  }
  if (!files.length) throw new Error(`Concat list has no file entries: ${listPath}`);
  return files;
}

const { flags } = parseArgs(process.argv.slice(2));
if (flags.help) {
  usage();
  process.exit(0);
}

if (!flags.concat) {
  usage();
  throw new Error('--concat is required');
}

const concatList = path.resolve(here, String(flags.concat));
const narration = path.resolve(here, String(flags.narration ?? 'narration.wav'));
const bed = path.resolve(here, String(flags.bed ?? 'bed.wav'));
const output = path.resolve(here, String(flags.out ?? 'final.mp4'));
const bedGainDb = Number(flags['bed-gain-db'] ?? 3);
const voiceLimit = Number(flags['voice-limit'] ?? 0.35);
const crf = String(flags.crf ?? 19);
const preset = String(flags.preset ?? 'medium');
const targetI = Number(flags['loudness-i'] ?? -15.5);
const targetTP = Number(flags['loudness-tp'] ?? -1.5);
const verifyTP = Number(flags['verify-tp'] ?? targetTP);
const targetLRA = Number(flags['loudness-lra'] ?? 11);
const pauseRegion = flags.pause !== undefined ? regionSpec(flags.pause) : null;
const speechRegion = flags.speech !== undefined ? regionSpec(flags.speech) : null;

for (const [label, file] of [['concat list', concatList], ['narration', narration], ['bed', bed]]) {
  if (!existsSync(file)) throw new Error(`${label} not found: ${file}`);
}
if (!(voiceLimit >= 0.0625 && voiceLimit <= 1)) throw new Error('--voice-limit must be in ffmpeg alimiter range 0.0625..1');
if (!Number.isFinite(bedGainDb)) throw new Error('--bed-gain-db must be numeric');

const chunks = parseConcatList(concatList);
console.log(`mux: concat list ${concatList}`);
console.log(`mux: ${chunks.length} video chunk(s)`);

let videoDuration = 0;
const chunkInfos = [];
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
  videoDuration += duration;
  chunkInfos.push({ file, width: v.width, height: v.height, fps, frames, duration, pix_fmt: v.pix_fmt, color_range: v.color_range });
  console.log(`  ${path.basename(file)}: ${duration.toFixed(6)}s, ${frames || '?'} frames, ${v.width}x${v.height}, fps=${fps}, input_pix_fmt=${v.pix_fmt}, input_range=${v.color_range}`);
}

const badShape = chunkInfos.find(x => x.width !== 1080 || x.height !== 1920 || Math.abs(x.fps - 30) > 0.001);
if (badShape) console.warn(`WARNING: chunk shape/fps differs from expected 1080x1920@30: ${path.basename(badShape.file)}`);

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
const pass1Graph = `${audioMixGraph({ duration: targetDuration, voiceLimit, bedGainDb, firstPass: true })};[premix]loudnorm=I=${targetI}:TP=${targetTP}:LRA=${targetLRA}:print_format=json[m]`;
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
const audioGraph = finalAudioGraph({ duration: targetDuration, voiceLimit, bedGainDb, loudnorm: loudnormSecond });
const finalGraph = `${videoGraph};${audioGraph}`;

// PASS 2 + video encode/mux.
const finalArgs = [
  '-y', '-hide_banner',
  '-f', 'concat', '-safe', '0', '-i', concatList,
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

// ffprobe stream/container verification.
const probe = await ffprobeJson(output);
const v = probe.streams?.find(s => s.codec_type === 'video');
const a = probe.streams?.find(s => s.codec_type === 'audio');
const boxScan = scanMp4Boxes(output);
const failures = [];
const warnings = [];

if (v?.codec_name !== 'h264') failures.push(`video codec is ${v?.codec_name}, expected h264`);
if (v?.width !== 1080 || v?.height !== 1920) failures.push(`video dimensions are ${v?.width}x${v?.height}, expected 1080x1920`);
if (Math.abs(parseRational(v?.avg_frame_rate || v?.r_frame_rate) - 30) > 0.001) failures.push(`video frame rate is ${v?.avg_frame_rate || v?.r_frame_rate}, expected 30`);
if (v?.pix_fmt !== 'yuv420p') failures.push(`pix_fmt is ${v?.pix_fmt}, expected yuv420p`);
if (v?.color_range !== 'tv') failures.push(`color_range is ${v?.color_range}, expected tv`);
if (v?.color_space !== 'bt709') failures.push(`colorspace is ${v?.color_space}, expected bt709`);
if (v?.color_primaries !== 'bt709') failures.push(`color_primaries is ${v?.color_primaries}, expected bt709`);
if (v?.color_transfer !== 'bt709') failures.push(`color_transfer is ${v?.color_transfer}, expected bt709`);
if (a?.codec_name !== 'aac') failures.push(`audio codec is ${a?.codec_name}, expected aac`);
if (Number(a?.sample_rate) !== 48000) failures.push(`audio sample_rate is ${a?.sample_rate}, expected 48000`);
if (Number(a?.channels) !== 1) failures.push(`audio channels is ${a?.channels}, expected 1`);
if (!boxScan.moovBeforeMdat) failures.push(`MP4 box order is ${boxScan.order.join('>')}; moov is not before mdat`);
const formatDuration = Number(probe.format?.duration);
if (!Number.isFinite(formatDuration) || Math.abs(formatDuration - targetDuration) > 0.15) {
  failures.push(`format duration is ${formatDuration}, expected about ${targetDuration}`);
}

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

let loudnessMeasured = null;
let pauseStats = null;
let speechStats = null;
if (!flags['skip-audio-verify']) {
  const measureArgs = ['-hide_banner', '-nostats', '-i', output, '-map', '0:a:0', '-af', `loudnorm=I=${targetI}:TP=${targetTP}:LRA=${targetLRA}:print_format=json`, '-f', 'null', '-'];
  console.log('\npost-encode loudness measurement command:');
  console.log(printCommand('ffmpeg', measureArgs));
  const lm = await runProcess('ffmpeg', measureArgs);
  loudnessMeasured = extractLoudnormJson(lm.stderr + lm.stdout);
  const hasRegions = pauseRegion && speechRegion;
  if (hasRegions) {
    pauseStats = await measureAstats(output, pauseRegion);
    speechStats = await measureAstats(output, speechRegion);
  } else {
    console.log('\nbed pause-vs-speech check skipped (pass --pause=a-b --speech=c-d at real regions of your film to enable it)');
  }
  const bedGap = hasRegions ? speechStats.rms - pauseStats.rms : null;

  const integrated = Number(loudnessMeasured.input_i);
  const truePeak = Number(loudnessMeasured.input_tp);
  const lra = Number(loudnessMeasured.input_lra);
  if (!(Math.abs(integrated - targetI) <= 0.25)) warnings.push(`integrated loudness ${integrated} LUFS differs from ${targetI} by more than 0.25 LU`);
  if (!(truePeak <= verifyTP + 0.01)) failures.push(`measured true peak ${truePeak} dBTP exceeds delivery ceiling ${verifyTP} dBTP`);
  if (bedGap !== null && !(bedGap >= 20 && bedGap <= 24)) warnings.push(`bed pause-vs-speech gap ${bedGap.toFixed(2)} dB is outside target 20-24 dB`);

  console.log('\naudio measurements:');
  console.log(JSON.stringify({
    integrated_lufs: integrated,
    true_peak_dbtp: truePeak,
    lra_lu: lra,
    threshold_lufs: Number(loudnessMeasured.input_thresh),
    pause_region: pauseStats && { ...pauseRegion, rms_db: pauseStats.rms, peak_db: pauseStats.peak },
    speech_region: speechStats && { ...speechRegion, rms_db: speechStats.rms, peak_db: speechStats.peak },
    bed_below_speech_db: bedGap,
  }, null, 2));
}

for (const w of warnings) console.warn(`WARNING: ${w}`);
if (failures.length) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  throw new Error('mux verification failed');
}
console.log('\nmux verification: PASS');
