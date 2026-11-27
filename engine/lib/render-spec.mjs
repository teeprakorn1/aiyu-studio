/**
 * @file render-spec.mjs — parsing of render time specs and rendered output file names.
 */

/**
 * Parse a comma-separated list of still timestamps in seconds.
 *
 * @param {string} raw - e.g. "1,5,9.5"
 * @returns {number[]} timestamps in seconds, each >= 0
 * @throws {Error} on empty, non-numeric, or negative entries
 */
export function parseStillTimes(raw) {
  const parts = String(raw).split(',');
  if (!String(raw).trim() || parts.some(x => !x.trim() || !Number.isFinite(Number(x)) || Number(x) < 0)) throw new Error(`invalid still timestamps: ${raw}`);
  return parts.map(Number);
}

/**
 * Parse a "from,to" video range in seconds.
 *
 * @param {string} raw - e.g. "0,100"
 * @returns {[number, number]} [from, to] in seconds with 0 <= from < to
 * @throws {Error} on malformed or reversed ranges
 */
export function parseVideoRange(raw) {
  const parts = String(raw).split(',');
  const [from, to] = parts.map(Number);
  if (parts.length !== 2 || parts.some(x => !x.trim()) || !Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= from) throw new Error(`invalid video range: ${raw}`);
  return [from, to];
}

/**
 * Output file name for a render: <prefix>_<from>-<to>.mp4 for a range, <prefix>.mp4 for the whole video.
 *
 * @param {string} prefix - file-name prefix from --out
 * @param {string} [clip] - "from,to" range in seconds
 * @returns {string} file name without directory
 */
export function outputNameFor(prefix, clip) {
  return clip ? `${prefix}_${clip.replace(',', '-')}.mp4` : `${prefix}.mp4`;
}
