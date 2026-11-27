/**
 * @file source.mjs — static helpers that read declarations, parameters, and JSDoc from template source text.
 */

/**
 * Index of the parenthesis that closes the one opened at `open`, skipping quoted text.
 *
 * @param {string} src - source text
 * @param {number} open - index of the opening parenthesis
 * @returns {number} index of the matching closing parenthesis
 */
export function closeParen(src, open) {
  let depth = 0, quote = null;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return i;
  }
  throw new Error('unbalanced parentheses');
}

/**
 * Parameter names of a parameter list, without defaults.
 *
 * @param {string} text - text between the parentheses
 * @returns {string[]} parameter names in order
 */
export function paramNames(text) {
  const out = []; let depth = 0, quote = null, cur = '';
  for (const ch of text) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(p => p.split('=')[0].trim()).filter(Boolean);
}

/**
 * Parameter names of the list opened at `open`.
 *
 * @param {string} src - source text
 * @param {number} open - index of the opening parenthesis
 * @returns {string[]} parameter names in order
 */
export function paramsAt(src, open) {
  return paramNames(src.slice(open + 1, closeParen(src, open)));
}

/**
 * Locate a top-level function or arrow-function declaration.
 *
 * @param {string} src - source text
 * @param {string} name - declared name
 * @returns {{index: number, params: string[]}|null} declaration position and parameter names; null when not declared as a function
 */
export function declaration(src, name) {
  const fn = new RegExp(`^function ${name}\\(`, 'm').exec(src);
  if (fn) return { index: fn.index, params: paramsAt(src, fn.index + fn[0].length - 1) };
  const arrow = new RegExp(`^const ${name} = (\\(|[A-Za-z_$][\\w$]* =>)`, 'm').exec(src);
  if (!arrow) return null;
  if (arrow[1] === '(') return { index: arrow.index, params: paramsAt(src, arrow.index + arrow[0].length - 1) };
  return { index: arrow.index, params: [arrow[1].split(/\s/)[0]] };
}

/**
 * JSDoc block that ends directly before an index, or null.
 *
 * @param {string} src - source text
 * @param {number} index - position of the declaration
 * @returns {string|null} the JSDoc block text
 */
export function docBefore(src, index) {
  const before = src.slice(0, index).replace(/\s+$/, '');
  if (!before.endsWith('*/')) return null;
  const start = before.lastIndexOf('/**');
  return start === -1 ? null : before.slice(start);
}

/**
 * Names listed in a file's `Object.assign(globalThis, {...})` export.
 *
 * @param {string} src - source text
 * @returns {string[]} exported names
 */
export function exportedNames(src) {
  const m = /Object\.assign\(globalThis,\s*\{([\s\S]*?)\}\);?/.exec(src);
  return m[1].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean);
}
