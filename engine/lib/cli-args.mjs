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
