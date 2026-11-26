/**
 * @file chunking.mjs — parallel-render chunk boundary math.
 * Pure logic extracted from publish.mjs so it can be unit-tested (thin-shell rule).
 */

/**
 * Compute contiguous whole-second chunk boundaries covering [0, end].
 * Guarantees: first is 0, last is end, strictly increasing by at least 1 second.
 *
 * @param {number} end - timeline end in whole seconds
 * @param {number} chunks - number of chunks
 * @returns {number[]} boundaries array of length chunks+1
 * @example
 * makeBoundaries(10, 3) // [0, 4, 7, 10] — each chunk at least 1s, no overlaps, no gaps
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
