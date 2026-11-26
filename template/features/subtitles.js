/**
 * @file features/subtitles.js — subtitle layout — Thai/English word segmentation, row balancing, caching, and the subs() draw call.
 * Part of the aiyu template runtime. Layer rules: core ← features ← story.
 */

(() => {

const SUB_CACHE = new Map();
/** Split subtitle text into wrappable units. Punctuation-only units merge into the
 *  preceding word so no row ever starts with a bare "," or "." — applies to all languages. */
function subUnits(txt) {
  let units = null;
  if (SEG_WORD) {
    try { units = Array.from(SEG_WORD.segment(txt), s => s.segment).filter(Boolean); } catch (e) { }
  }
  if (!units) units = txt.split(/(\s+)/).filter(Boolean);
  const out = [];
  for (const u of units) {
    if (out.length && /^[,.!?;:'"’‘—–…\)\]]+$/.test(u) && !/^\s+$/.test(out[out.length - 1])) out[out.length - 1] += u;
    else out.push(u);
  }
  return out;
}
function measureSub(txt, size) {
  g.font = `700 ${size}px ${FONT}`;
  return g.measureText(txt).width;
}
function greedySubRows(units, size) {
  const rows = [];
  let row = '';
  for (const unit of units) {
    if (!row && /^\s+$/.test(unit)) continue;
    const next = row + unit;
    if (row.trim() && measureSub(next, size) > SUB_TEXT_MAX) {
      rows.push(row.trim());
      row = /^\s+$/.test(unit) ? '' : unit;
    } else row = next;
  }
  if (row.trim()) rows.push(row.trim());
  return rows;
}
function balancedSubRows(units, count, size) {
  const n = units.length;
  const piece = (a, b) => units.slice(a, b).join('').trim();
  const scored = cuts => {
    const rows = [], widths = [];
    let at = 0;
    for (const cut of cuts.concat(n)) {
      const row = piece(at, cut);
      if (!row) return null;
      rows.push(row); widths.push(measureSub(row, size)); at = cut;
    }
    const maxWidth = Math.max(...widths), spread = maxWidth - Math.min(...widths);
    return { rows, widths, maxWidth, score: maxWidth + spread * .14 };
  };
  if (count === 1) return scored([]);
  let best = null;
  const keep = r => { if (r && (!best || r.score < best.score)) best = r; };
  if (count === 2) {
    for (let a = 1; a < n; a++) keep(scored([a]));
  } else {
    for (let a = 1; a < n - 1; a++) for (let b = a + 1; b < n; b++) keep(scored([a, b]));
  }
  return best;
}
function layoutSubs(txt) {
  if (SUB_CACHE.has(txt)) return SUB_CACHE.get(txt);
  const units = subUnits(txt);
  let out = null;
  for (let size = SUB_BASE; size >= SUB_MIN && !out; size--) {
    const natural = greedySubRows(units, size);
    if (natural.length > SUB_MAX_ROWS) continue;
    const fit = balancedSubRows(units, natural.length, size);
    if (fit && fit.maxWidth <= SUB_TEXT_MAX) out = { ...fit, size, frameWidth: fit.maxWidth + SUB_PAD_X * 2 + SUB_STROKE };
  }
  if (!out) {
    const size = SUB_MIN, fit = balancedSubRows(units, Math.min(SUB_MAX_ROWS, units.length), size);
    out = { ...fit, size, frameWidth: fit.maxWidth + SUB_PAD_X * 2 + SUB_STROKE, overflow: true };
  }
  SUB_CACHE.set(txt, out);
  return out;
}
function subs(o) {
  const ln = o.line;
  if (!ln || !ln.txt) return;
  const lay = layoutSubs(ln.txt);
  const a = Math.min(1, o.lp * 8);
  const size = lay.size, lineH = Math.round(size * 1.18), pillH = Math.round(size * 1.12);
  const bottomBaseline = 1490;
  const firstBaseline = bottomBaseline - (lay.rows.length - 1) * lineH;
  g.save(); g.globalAlpha = a;
  g.font = `700 ${size}px ${FONT}`; g.textAlign = 'center'; g.lineJoin = 'round';
  lay.rows.forEach((row, i) => {
    const baseline = firstBaseline + i * lineH;
    const w = lay.widths[i] + SUB_PAD_X * 2;
    const top = baseline - pillH * .78;
    RRECT(W / 2 - w / 2, top, w, pillH, pillH / 2, 'rgba(8,8,12,.66)');
    g.lineWidth = SUB_STROKE; g.strokeStyle = '#000'; g.strokeText(row, W / 2, baseline);
    g.fillStyle = '#f4f1ea'; g.fillText(row, W / 2, baseline);
  });
  g.restore();
}
/** Line-scoped reveal progress: 0 before line n, ramps 0→1 during line n, stays 1 after.
 *  Use for any element that appears at a line and must NOT re-animate on later lines —
 *  feeding o.lp directly re-triggers the animation every time the narration advances. */

Object.assign(globalThis, { layoutSubs,subs });
})();
