/**
 * @file features/subtitles.js — subtitle layout — Thai/English word segmentation, row balancing, caching, and the subs() draw call.
 * Part of the aiyu template runtime. Layer rules: core ← features ← story.
 */

(() => {

const SUB_FRAME_MAX = 840, SUB_PAD_X = 24, SUB_STROKE = 10, SUB_TEXT_MAX = SUB_FRAME_MAX - SUB_PAD_X * 2 - SUB_STROKE;
const SUB_BASE = 52, SUB_MIN = 40, SUB_MAX_ROWS = 3;
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
/** Map each character of txt to its timing-word index via sequential matching.
 *  Pure function — Thai caveat: TTS/whisper tokens are subword-ish and may not cover
 *  every character; unmatched chars map to -1 and simply follow the base styling. */
function karaokeMap(txt, words) {
  const map = new Array(txt.length).fill(-1);
  let pos = 0;
  words.forEach((word, wi) => {
    const w = word.w || '';
    if (!w) return;
    const at = txt.indexOf(w, pos);
    if (at === -1) return;
    for (let i = at; i < at + w.length && i < txt.length; i++) map[i] = wi;
    pos = at + w.length;
  });
  return map;
}
/** Index of the word being spoken at time-in-line tline (seconds since line start). */
function karaokeActiveIdx(words, lineT0, tline) {
  let idx = -1;
  for (let i = 0; i < words.length; i++) {
    if (words[i].t0 - lineT0 <= tline + 0.04) idx = i;  // small lead feels more natural
    else break;
  }
  return idx;
}
function subs(o) {
  const ln = o.line;
  if (!ln || !ln.txt) return;
  const lay = layoutSubs(ln.txt);
  const a = Math.min(1, o.lp * 8);
  const size = lay.size, lineH = Math.round(size * 1.18), pillH = Math.round(size * 1.12);
  const bottomBaseline = 1490;
  const firstBaseline = bottomBaseline - (lay.rows.length - 1) * lineH;
  // entrance: spring scale pop composed over the alpha ramp — exact damped-harmonic,
  // pure function of line progress, determinism-safe
  const sc = 0.82 + 0.18 * springy(a, 170, 12);
  g.save(); g.globalAlpha = a;
  g.translate(W / 2, firstBaseline + (lay.rows.length - 1) * lineH / 2);
  g.scale(sc, sc);
  g.translate(-W / 2, -(firstBaseline + (lay.rows.length - 1) * lineH / 2));
  g.font = `700 ${size}px ${FONT}`; g.textAlign = 'center'; g.lineJoin = 'round';
  const karaokeOn = !!(globalThis.SUB_KARAOKE && ln.words && ln.words.length);
  const kmap = karaokeOn ? karaokeMap(ln.txt, ln.words) : null;
  const activeIdx = karaokeOn ? karaokeActiveIdx(ln.words, ln.t0, o.lp * ln.dur) : -1;
  const HI = '#ffd166';
  let rowSearchPos = 0;
  lay.rows.forEach((row, i) => {
    const baseline = firstBaseline + i * lineH;
    const w = lay.widths[i] + SUB_PAD_X * 2;
    const top = baseline - pillH * .78;
    RRECT(W / 2 - w / 2, top, w, pillH, pillH / 2, 'rgba(8,8,12,.66)');
    g.lineWidth = SUB_STROKE; g.strokeStyle = '#000'; g.strokeText(row, W / 2, baseline);
    g.fillStyle = '#f4f1ea'; g.fillText(row, W / 2, baseline);
    if (!karaokeOn) return;
    // highlight pass: redraw spoken prefix chars left-to-right; active word pops slightly
    const found = ln.txt.indexOf(row, rowSearchPos);
    const rowStart = found !== -1 ? found : rowSearchPos;
    rowSearchPos = rowStart + row.length;
    const x0 = W / 2 - lay.widths[i] / 2;
    g.textAlign = 'left';
    for (let ci = 0; ci < row.length; ci++) {
      const wi = kmap[rowStart + ci] ?? -1;
      const ch = row[ci];
      const cw = g.measureText(ch).width;
      const x = x0 + g.measureText(row.slice(0, ci)).width;
      if (wi !== -1 && wi <= activeIdx) {
        const isActive = wi === activeIdx;
        if (isActive) {
          const pop = 1.12;
          g.save();
          g.translate(x + cw / 2, baseline - size * 0.35);
          g.scale(pop, pop);
          g.translate(-(x + cw / 2), -(baseline - size * 0.35));
        }
        g.lineWidth = SUB_STROKE; g.strokeStyle = '#000'; g.strokeText(ch, x, baseline);
        g.fillStyle = HI; g.fillText(ch, x, baseline);
        if (isActive) g.restore();
      }
    }
    g.textAlign = 'center';
  });
  g.restore();
}
/** Line-scoped reveal progress: 0 before line n, ramps 0→1 during line n, stays 1 after.
 *  Use for any element that appears at a line and must NOT re-animate on later lines —
 *  feeding o.lp directly re-triggers the animation every time the narration advances. */

registerOverlay(20, subs);
Object.assign(globalThis, { layoutSubs, subs, karaokeMap, karaokeActiveIdx });
})();
