/**
 * @file encoding.mjs — shared x264 encoding option validation for engine scripts.
 */

const PRESETS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'];

/**
 * Validate x264 encoding options before browser/render work starts.
 *
 * @param {string|number} crf - x264 constant-rate-factor, integer 0..51
 * @param {string} preset - x264 preset name
 * @returns {{crf: string, preset: string}} normalized string values for ffmpeg argv
 */
export function validateX264(crf, preset) {
  const c = String(crf);
  const p = String(preset);
  if (!/^\d+$/.test(c) || Number(c) < 0 || Number(c) > 51) throw new Error('--crf must be an integer in range 0..51');
  if (!PRESETS.includes(p)) throw new Error(`invalid x264 preset: ${p}`);
  return { crf: c, preset: p };
}
