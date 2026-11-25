#!/usr/bin/env node
// Final v4 mux/encode: concat silent chunks, fix full-range color to limited BT.709,
// mix narration + looped music bed, two-pass loudness normalize, AAC, faststart MP4.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, readSync, fstatSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq >= 0) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}

function usage() {
  console.log(`Usage: node mux-v4.mjs --concat=out/v4concat.txt [options]

Required:
  --concat=<file>          FFmpeg concat-demuxer list of silent video chunks

Options:
  --narration=narration.wav
  --bed=bed.wav
  --out=<mp4>              Default: ../video/output.mp4
  --bed-gain-db=3          Music bed gain before mixing. +3 dB measured as ~21-23 dB below speech.
  --voice-limit=0.35       Lookahead peak-limiter ceiling for narration (linear amplitude).
                           Needed because raw narration true peak is about +0.84 dBTP.
  --crf=19                 x264 CRF
  --preset=medium          x264 preset
  --loudness-i=-15.5       Integrated loudness target, LUFS
  --loudness-tp=-1.5       True-peak ceiling target, dBTP
  --loudness-lra=11        Loudness-range target, LU
  --pause=40.4-41.4        Verification pause region, seconds
  --speech=10-30           Verification speech region, seconds
  --skip-audio-verify      Do not run post-encode loudness/RMS measurements
  --help

Example:
  node mux-v4.mjs --concat=out/v4concat.txt
`);
}

function shellQuote(s) {
  const text = String(s);
  return /^[A-Za-z0-9_./:=+-]+$/.test(text) ? text : `'${text.replace(/'/g, `'\\''`)}'`;
}

function printCommand(cmd, args) {
  return [cmd, ...args].map(shellQuote).join(' ');
}

function runProcess(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let lastProgress = 0;
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => {
      const text = d.toString();
      stderr += text;
      if (opts.progress) {
        const m = text.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (m) {
          const t = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
          if (t - lastProgress >= 20) {
            lastProgress = t;
            console.log(`  encode progress: ${t.toFixed(1)}s`);
          }
        }
      }
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve({ stdout, stderr, code });
      else {
        const err = new Error(`${cmd} exited with code ${code}\n${stderr.slice(-5000)}`);
        err.stdout = stdout;
        err.stderr = stderr;
        err.code = code;
        reject(err);
      }
    });
  });
}

async function ffprobeJson(file, extraEntries) {
  const entries = extraEntries || 'stream=index,codec_name,codec_type,width,height,pix_fmt,color_range,color_space,color_primaries,color_transfer,r_frame_rate,avg_frame_rate,nb_frames,duration,sample_rate,channels,channel_layout,profile,bit_rate:format=duration,size,bit_rate';
  const args = ['-v', 'error', '-show_entries', entries, '-of', 'json', file];
  const r = await runProcess('ffprobe', args);
  return JSON.parse(r.stdout);
}

function parseRational(x) {
  if (!x) return NaN;
  const [n, d = '1'] = String(x).split('/');
  return Number(n) / Number(d);
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

function fmtDurationValue(x) {
  return Number(Number(x).toFixed(6)).toString();
}

function extractLoudnormJson(text) {
  const m = text.match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!m) throw new Error(`Could not find loudnorm JSON in ffmpeg output. Tail:\n${text.slice(-2500)}`);
  return JSON.parse(m[0]);
}

function regionSpec(s, fallback) {
  const text = String(s ?? fallback);
  const m = text.match(/^([0-9.]+)\s*-\s*([0-9.]+)$/);
  if (!m) throw new Error(`Invalid time region '${text}'; expected START-END`);
  return { start: Number(m[1]), end: Number(m[2]) };
}

async function measureAstats(file, region) {
  const af = `atrim=start=${region.start}:end=${region.end},asetpts=PTS-STARTPTS,astats`;
  const r = await runProcess('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', af, '-f', 'null', '-']);
  const text = r.stderr + r.stdout;
  const at = text.lastIndexOf('Overall');
  const overall = at >= 0 ? text.slice(at) : text;
  const rms = Number(overall.match(/RMS level dB:\s*(-?[0-9.]+)/)?.[1]);
  const peak = Number(overall.match(/Peak level dB:\s*(-?[0-9.]+)/)?.[1]);
  return { rms, peak };
}

function scanMp4Boxes(file) {
  const fd = openSync(file, 'r');
  try {
    const size = fstatSync(fd).size;
    const order = [];
    let pos = 0;
    while (pos + 8 <= size && order.length < 16) {
      const hdr = Buffer.alloc(16);
      readSync(fd, hdr, 0, 8, pos);
      let boxSize = hdr.readUInt32BE(0);
      const type = hdr.toString('ascii', 4, 8);
      let header = 8;
      if (boxSize === 1) {
        readSync(fd, hdr, 0, 16, pos);
        boxSize = Number(hdr.readBigUInt64BE(8));
        header = 16;
      } else if (boxSize === 0) {
        boxSize = size - pos;
      }
      if (!Number.isFinite(boxSize) || boxSize < header) break;
      order.push({ type, offset: pos, size: boxSize });
      if (order.some(x => x.type === 'moov') && order.some(x => x.type === 'mdat')) break;
      pos += boxSize;
    }
    const moov = order.findIndex(x => x.type === 'moov');
    const mdat = order.findIndex(x => x.type === 'mdat');
    return {
      order: order.map(x => x.type),
      moovBeforeMdat: moov >= 0 && mdat >= 0 && moov < mdat,
      moovIndex: moov,
      mdatIndex: mdat,
    };
  } finally {
    closeSync(fd);
  }
}

function audioMixGraph({ duration, voiceLimit, bedGainDb, firstPass }) {
  const dur = fmtDurationValue(duration);
  const narration = `[0:a]aresample=48000,alimiter=limit=${voiceLimit}:level=false:latency=true,apad=whole_dur=${dur},atrim=duration=${dur},asetpts=PTS-STARTPTS[n]`;
  const bed = `[1:a]aresample=48000,volume=${bedGainDb}dB,atrim=duration=${dur},asetpts=PTS-STARTPTS[b]`;
  const mix = `[n][b]amix=inputs=2:duration=first:dropout_transition=0:normalize=0${firstPass ? '[premix]' : '[mix]'}`;
  return `${narration};${bed};${mix}`;
}

function finalAudioGraph({ duration, voiceLimit, bedGainDb, loudnorm }) {
  const dur = fmtDurationValue(duration);
  const narration = `[1:a]aresample=48000,alimiter=limit=${voiceLimit}:level=false:latency=true,apad=whole_dur=${dur},atrim=duration=${dur},asetpts=PTS-STARTPTS[n]`;
  const bed = `[2:a]aresample=48000,volume=${bedGainDb}dB,atrim=duration=${dur},asetpts=PTS-STARTPTS[b]`;
  const ln = [
    `I=${loudnorm.i}`,
    `TP=${loudnorm.tp}`,
    `LRA=${loudnorm.lra}`,
    `measured_I=${loudnorm.measured_I}`,
    `measured_TP=${loudnorm.measured_TP}`,
    `measured_LRA=${loudnorm.measured_LRA}`,
    `measured_thresh=${loudnorm.measured_thresh}`,
    `offset=${loudnorm.offset}`,
    'linear=true',
  ].join(':');
  return `${narration};${bed};[n][b]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,loudnorm=${ln},aresample=48000,atrim=duration=${dur},asetpts=PTS-STARTPTS[a]`;
}

const flags = parseArgs(process.argv.slice(2));
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
const output = path.resolve(here, String(flags.out ?? path.join('..', 'video', 'output.mp4')));
const bedGainDb = Number(flags['bed-gain-db'] ?? 3);
const voiceLimit = Number(flags['voice-limit'] ?? 0.35);
const crf = String(flags.crf ?? 19);
const preset = String(flags.preset ?? 'medium');
const targetI = Number(flags['loudness-i'] ?? -15.5);
const targetTP = Number(flags['loudness-tp'] ?? -1.5);
const targetLRA = Number(flags['loudness-lra'] ?? 11);
const pauseRegion = regionSpec(flags.pause, '40.4-41.4');
const speechRegion = regionSpec(flags.speech, '10-30');

for (const [label, file] of [['concat list', concatList], ['narration', narration], ['bed', bed]]) {
  if (!existsSync(file)) throw new Error(`${label} not found: ${file}`);
}
if (!(voiceLimit >= 0.0625 && voiceLimit <= 1)) throw new Error('--voice-limit must be in ffmpeg alimiter range 0.0625..1');
if (!Number.isFinite(bedGainDb)) throw new Error('--bed-gain-db must be numeric');

const chunks = parseConcatList(concatList);
console.log(`mux-v4: concat list ${concatList}`);
console.log(`mux-v4: ${chunks.length} video chunk(s)`);

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
console.log(`mux-v4: target duration ${targetDuration.toFixed(6)}s; narration ${narrationDuration.toFixed(3)}s (padding ${(targetDuration - narrationDuration).toFixed(3)}s, no truncation)`);
console.log(`mux-v4: bed gain ${bedGainDb} dB; voice lookahead limiter ceiling ${voiceLimit}`);

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
console.log('\nmux-v4 loudnorm pass 1 command:');
console.log(printCommand('ffmpeg', pass1Args));
const pass1 = await runProcess('ffmpeg', pass1Args);
const measured = extractLoudnormJson(pass1.stderr + pass1.stdout);
console.log('mux-v4 loudnorm pass 1 measurements:', JSON.stringify(measured, null, 2));

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
console.log('\nmux-v4 final encode command:');
console.log(printCommand('ffmpeg', finalArgs));
await runProcess('ffmpeg', finalArgs, { progress: true });

if (!existsSync(output) || !statSync(output).size) throw new Error(`encode completed but output missing/empty: ${output}`);
console.log(`\nmux-v4: wrote ${output} (${statSync(output).size} bytes)`);

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
  pauseStats = await measureAstats(output, pauseRegion);
  speechStats = await measureAstats(output, speechRegion);
  const bedGap = speechStats.rms - pauseStats.rms;

  const integrated = Number(loudnessMeasured.input_i);
  const truePeak = Number(loudnessMeasured.input_tp);
  const lra = Number(loudnessMeasured.input_lra);
  if (!(Math.abs(integrated - targetI) <= 0.25)) warnings.push(`integrated loudness ${integrated} LUFS differs from ${targetI} by more than 0.25 LU`);
  if (!(truePeak <= targetTP + 0.01)) failures.push(`measured true peak ${truePeak} dBTP exceeds ${targetTP} dBTP`);
  if (!(bedGap >= 20 && bedGap <= 24)) warnings.push(`bed pause-vs-speech gap ${bedGap.toFixed(2)} dB is outside target 20-24 dB`);

  console.log('\naudio measurements:');
  console.log(JSON.stringify({
    integrated_lufs: integrated,
    true_peak_dbtp: truePeak,
    lra_lu: lra,
    threshold_lufs: Number(loudnessMeasured.input_thresh),
    pause_region: { ...pauseRegion, rms_db: pauseStats.rms, peak_db: pauseStats.peak },
    speech_region: { ...speechRegion, rms_db: speechStats.rms, peak_db: speechStats.peak },
    bed_below_speech_db: bedGap,
  }, null, 2));
}

for (const w of warnings) console.warn(`WARNING: ${w}`);
if (failures.length) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  throw new Error('mux-v4 verification failed');
}
console.log('\nmux-v4 verification: PASS');
