/**
 * @file chunking.mjs — parallel-render chunk boundaries and chunk job planning (pure logic, unit-tested).
 */
import path from 'node:path';
import { outputNameFor } from './render-spec.mjs';

/**
 * Compute contiguous whole-second chunk boundaries covering [0, end].
 * Guarantees: first is 0, last is end, strictly increasing by at least 1 second.
 *
 * @param {number} end - timeline end in whole seconds
 * @param {number} chunks - number of chunks
 * @returns {number[]} boundaries array of length chunks+1
 * @example
 * makeBoundaries(10, 3) // [0, 3, 7, 10] — each chunk at least 1s, no overlaps, no gaps
 */
export function makeBoundaries(end, chunks) {
  const bounds = [0];
  for (let k = 1; k < chunks; k++) bounds.push(Math.round((end * k) / chunks));
  bounds.push(end);
  return bounds.map((v, i, a) => (i === 0 ? v : Math.max(v, a[i - 1] + 1)));
}

/**
 * Escape a path for the ffmpeg concat demuxer (single-quote escaping).
 *
 * @param {string} p - file path
 * @returns {string} concat-safe path
 */
export function escapeConcatPath(p) {
  return p.replace(/'/g, "'\\''");
}

/**
 * Plan one render command per chunk of a publish run.
 *
 * @param {object} opts
 * @param {number} opts.end - timeline end in whole seconds
 * @param {number} opts.chunks - number of parallel chunks
 * @param {string} opts.outPrefix - output file prefix
 * @param {string} opts.root - project root that holds out/
 * @param {string} opts.page - page passed to render.mjs
 * @param {string|undefined} opts.browser - browser binary passed through when set
 * @param {string} opts.crf - x264 CRF
 * @param {string} opts.preset - x264 preset
 * @param {boolean} opts.force - pass --force through to render.mjs
 * @param {string} opts.renderScript - absolute path of render.mjs
 * @param {number} [opts.fps=30] - frames per second
 * @returns {object[]} jobs with index, from, to, range, output, relOutput, frames, args
 */
export function planChunkJobs({ end, chunks, outPrefix, root, page, browser, crf, preset, force, renderScript, fps = 30 }) {
  const bounds = makeBoundaries(end, chunks);
  return Array.from({ length: chunks }, (_, k) => {
    const from = bounds[k];
    const to = bounds[k + 1];
    const range = `${from},${to}`;
    const output = path.join(root, 'out', outputNameFor(outPrefix, range));
    const args = [renderScript, 'video', range, `--page=${page}`, `--out=${outPrefix}`, `--crf=${crf}`, `--preset=${preset}`];
    if (browser) args.push(`--browser=${browser}`);
    if (force) args.push('--force');
    return { index: k, from, to, range, output, relOutput: path.relative(root, output).replaceAll('\\', '/'), frames: Math.round((to - from) * fps), args };
  });
}
