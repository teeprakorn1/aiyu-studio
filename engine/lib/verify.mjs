/**
 * @file verify.mjs — pure evaluation of the final mux output against the publish QC gates.
 */
import { parseRational } from './ffmpeg.mjs';

/**
 * Evaluate the final file. Every failed check is a hard failure; warnings do not exist.
 *
 * @param {object} args
 * @param {{streams: object[], format: object}} args.probe - ffprobe JSON of the final mp4
 * @param {{moovBeforeMdat: boolean, order: string[]}} args.boxScan - MP4 top-level box order
 * @param {number} args.targetDuration - expected duration in seconds
 * @param {number} args.targetI - integrated loudness target in LUFS
 * @param {number} args.verifyTP - true-peak ceiling in dBTP
 * @param {{integrated: number, truePeak: number, bedGap: number|null}|null} [args.audio] - measured audio values; null when audio verification was skipped
 * @param {number} [args.fps=30] - delivery frame rate in frames per second
 * @returns {{failures: string[]}} failure messages; empty when the file passes every gate
 */
export function evaluateFinal({ probe, boxScan, targetDuration, targetI, verifyTP, audio = null, fps = 30 }) {
  const failures = [];
  const v = probe.streams?.find(s => s.codec_type === 'video');
  const a = probe.streams?.find(s => s.codec_type === 'audio');
  if (v?.codec_name !== 'h264') failures.push(`video codec is ${v?.codec_name}, expected h264`);
  if (v?.width !== 1080 || v?.height !== 1920) failures.push(`video dimensions are ${v?.width}x${v?.height}, expected 1080x1920`);
  if (Math.abs(parseRational(v?.avg_frame_rate || v?.r_frame_rate) - fps) > 0.001) failures.push(`video frame rate is ${v?.avg_frame_rate || v?.r_frame_rate}, expected ${fps}`);
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
  if (!Number.isFinite(formatDuration) || Math.abs(formatDuration - targetDuration) > 0.15) failures.push(`format duration is ${formatDuration}, expected about ${targetDuration}`);
  const frames = Number(v?.nb_frames);
  const expectedFrames = Math.round(targetDuration * fps);
  if (!Number.isFinite(frames) || Math.abs(frames - expectedFrames) > 1) failures.push(`video frame count is ${v?.nb_frames}, expected ${expectedFrames} (fps x duration)`);
  if (audio) {
    if (!(Math.abs(audio.integrated - targetI) <= 0.25)) failures.push(`integrated loudness ${audio.integrated} LUFS differs from ${targetI} by more than 0.25 LU`);
    if (!(audio.truePeak <= verifyTP + 0.01)) failures.push(`measured true peak ${audio.truePeak} dBTP exceeds delivery ceiling ${verifyTP} dBTP`);
    if (audio.bedGap !== null && audio.bedGap !== undefined && !(audio.bedGap >= 20 && audio.bedGap <= 24)) failures.push(`bed pause-vs-speech gap ${audio.bedGap.toFixed(2)} dB is outside target 20-24 dB`);
  }
  return { failures };
}
