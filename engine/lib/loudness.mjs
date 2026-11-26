/**
 * @file loudness.mjs — loudness measurement and ffmpeg audio filter-graph construction.
 * Pure builders except measureAstats, which shells out to ffmpeg.
 */
import { runProcess } from './ffmpeg.mjs';

/**
 * Format a seconds value compactly for ffmpeg filter arguments.
 *
 * @param {number|string} x - seconds
 * @returns {string} trimmed decimal string
 */
export function fmtDurationValue(x) {
  return Number(Number(x).toFixed(6)).toString();
}

/**
 * Extract the loudnorm measurement JSON block from ffmpeg output.
 *
 * @param {string} text - ffmpeg output containing a loudnorm print_format=json block
 * @returns {object} parsed measurement { input_i, input_tp, input_lra, input_thresh, ... }
 */
export function extractLoudnormJson(text) {
  const m = text.match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!m) throw new Error(`Could not find loudnorm JSON in ffmpeg output. Tail:\n${text.slice(-2500)}`);
  return JSON.parse(m[0]);
}

/**
 * Parse a "START-END" seconds region.
 *
 * @param {string} s - user-supplied region
 * @param {string} [fallback] - used when s is undefined
 * @returns {{ start: number, end: number }} region in seconds
 */
export function regionSpec(s, fallback) {
  const text = String(s ?? fallback).trim();
  const m = text.match(/^([0-9.]+)\s*-\s*([0-9.]+)$/);
  if (!m) throw new Error(`Invalid time region '${text}'; expected START-END`);
  const start = Number(m[1]), end = Number(m[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error(`Invalid time region '${text}'; end must be greater than start`);
  return { start, end };
}

/**
 * Measure RMS/peak levels of a file region with ffmpeg astats.
 *
 * @param {string} file - media file path
 * @param {{ start: number, end: number }} region - seconds region
 * @returns {Promise<{ rms: number, peak: number }>} levels in dB
 */
export async function measureAstats(file, region) {
  const af = `atrim=start=${region.start}:end=${region.end},asetpts=PTS-STARTPTS,astats`;
  const r = await runProcess('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', af, '-f', 'null', '-']);
  const text = r.stderr + r.stdout;
  const at = text.lastIndexOf('Overall');
  const overall = at >= 0 ? text.slice(at) : text;
  const rms = Number(overall.match(/RMS level dB:\s*(-?[0-9.]+)/)?.[1]);
  const peak = Number(overall.match(/Peak level dB:\s*(-?[0-9.]+)/)?.[1]);
  return { rms, peak };
}

/**
 * Build the first-pass narration+bed mix filter graph (inputs 0=narration 1=bed).
 *
 * @param {{ duration: number, voiceLimit: number, bedGainDb: number, firstPass: boolean }} cfg
 * @returns {string} ffmpeg -filter_complex graph
 */
/** Bed chain fragment shared by both passes: static gain, optionally followed by
 *  sidechain ducking driven by the narration copy [nk]. One definition — never duplicate. */
function bedChain(inputIdx, duration, bedGainDb, duck) {
  const dur = fmtDurationValue(duration);
  const base = `[${inputIdx}:a]aresample=48000,volume=${bedGainDb}dB,atrim=duration=${dur},asetpts=PTS-STARTPTS`;
  if (!duck) return `${base}[b]`;
  const d = `threshold=${duck.threshold}:ratio=${duck.ratio}:attack=${duck.attack}:release=${duck.release}:makeup=1`;
  return `${base}[bg];[bg][nk]sidechaincompress=${d}[b]`;
}

/** Narration chain fragment: when ducking, split narration into the mix copy and the sidechain key. */
function narrationChain(inputIdx, duration, voiceLimit, duck) {
  const dur = fmtDurationValue(duration);
  const base = `[${inputIdx}:a]aresample=48000,alimiter=limit=${voiceLimit}:level=false:latency=true,apad=whole_dur=${dur},atrim=duration=${dur},asetpts=PTS-STARTPTS`;
  return duck ? `${base}[na];[na]asplit=2[n][nk]` : `${base}[n]`;
}

export function audioMixGraph({ duration, voiceLimit, bedGainDb, firstPass, duck = null }) {
  const narration = narrationChain(0, duration, voiceLimit, duck);
  const bed = bedChain(1, duration, bedGainDb, duck);
  const mix = `[n][b]amix=inputs=2:duration=first:dropout_transition=0:normalize=0${firstPass ? '[premix]' : '[mix]'}`;
  return `${narration};${bed};${mix}`;
}

/**
 * Build the final-pass filter graph: mix + linear loudnorm correction (inputs 1=narration 2=bed).
 *
 * @param {{ duration: number, voiceLimit: number, bedGainDb: number, loudnorm: object }} cfg
 * @returns {string} ffmpeg -filter_complex graph emitting [a]
 */
export function finalAudioGraph({ duration, voiceLimit, bedGainDb, loudnorm, duck = null }) {
  const dur = fmtDurationValue(duration);
  const narration = narrationChain(1, duration, voiceLimit, duck);
  const bed = bedChain(2, duration, bedGainDb, duck);
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
