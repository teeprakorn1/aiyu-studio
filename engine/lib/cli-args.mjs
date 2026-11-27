/**
 * @file cli-args.mjs — shared CLI parsing for engine scripts.
 * Supports `--key=value`, `--key value`, boolean `--key`, and positional arguments.
 */

/**
 * Parse process.argv-style tokens into flags and positionals.
 *
 * @param {string[]} argv - tokens after `node script.mjs`
 * @returns {{ flags: Object<string, string|true>, pos: string[] }}
 * @example
 * const { flags, pos } = parseArgs(process.argv.slice(2));
 */
export function parseArgs(argv) {
  const flags = {}, pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq >= 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[a.slice(2)] = argv[++i];
    else flags[a.slice(2)] = true;
  }
  return { flags, pos };
}

/**
 * Reject unknown CLI flags with a deterministic error.
 *
 * @param {Object<string, string|true>} flags - parsed flags
 * @param {string[]} allowed - allowed flag names without leading dashes
 * @param {string} script - script name for the error message
 * @returns {void}
 */
export function assertKnownFlags(flags, allowed, script) {
  const ok = new Set(allowed);
  const bad = Object.keys(flags).filter(k => !ok.has(k));
  if (bad.length) throw new Error(`${script}: unknown flag(s): ${bad.map(k => '--' + k).join(', ')}`);
}

/**
 * Read a flag that takes a value. A bare `--key` is an error, never a silent 1.
 *
 * @param {Object<string, string|true>} flags - parsed flags
 * @param {string} name - flag name without leading dashes
 * @returns {string|undefined} the value, or undefined when the flag is absent
 * @throws {Error} when the flag was given without a value
 */
export function flagValue(flags, name) {
  const v = flags[name];
  if (v === true) throw new Error(`--${name} requires a value (use --${name}=<value>)`);
  return v;
}

/**
 * Read a string flag with a fallback.
 *
 * @param {Object<string, string|true>} flags - parsed flags
 * @param {string} name - flag name without leading dashes
 * @param {string|undefined} fallback - value used when the flag is absent
 * @returns {string|undefined} flag value or fallback
 */
export function strFlag(flags, name, fallback) {
  const v = flagValue(flags, name);
  return v === undefined ? fallback : v;
}

/**
 * Read a numeric flag with a fallback and an inclusive range.
 *
 * @param {Object<string, string|true>} flags - parsed flags
 * @param {string} name - flag name without leading dashes
 * @param {number} fallback - value used when the flag is absent
 * @param {{min?: number, max?: number, integer?: boolean}} [range] - inclusive bounds; integer requires a whole number
 * @returns {number} parsed value
 * @throws {Error} on a bare flag, non-numeric text, or a value outside the range
 */
export function numFlag(flags, name, fallback, { min = -Infinity, max = Infinity, integer = false } = {}) {
  const raw = flagValue(flags, name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (String(raw).trim() === '' || !Number.isFinite(n) || (integer && !Number.isInteger(n)) || n < min || n > max) {
    throw new Error(`--${name} must be ${integer ? 'an integer' : 'a number'} in range ${min}..${max}, got "${raw}"`);
  }
  return n;
}
