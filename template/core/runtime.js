/**
 * @file core/runtime.js — composition root — sourceChips, footnote, shot() scene runner, render() entry point.
 * Part of the aiyu template runtime. Layer rules: core ← features ← story.
 */

function sourceChips(o) {
  const rows = typeof SRCCHIPS !== 'undefined' && Array.isArray(SRCCHIPS) ? SRCCHIPS : [];
  if (!rows.length) return;
  const active = rows.filter(r => Array.isArray(r) && o.i >= r[0] && o.i <= r[1] && r[2]).slice(0, 2);
  if (!active.length) return;
  active.forEach(([from, to, label], k) => {
    const start = L[from] ? L[from].t0 : o.t, endLine = L[to] || L[from] || { t0: o.t, dur: 0 };
    const end = endLine.t0 + endLine.dur;
    const fade = clamp01(Math.min((o.t - start) / .45, (end - o.t) / .45, 1));
    if (fade <= 0) return;
    let txt = String(label), size = 26;
    g.font = `700 ${size}px ${FONT}`;
    if (g.measureText(txt).width > 820) size = 24;
    g.font = `700 ${size}px ${FONT}`;
    while (g.measureText(txt).width > 840 && txt.length > 4) {
      const parts = SEG_GRAPH ? Array.from(SEG_GRAPH.segment(txt), s => s.segment) : Array.from(txt);
      txt = parts.slice(0, -2).join('') + '…';
    }
    const w = Math.min(900, g.measureText(txt).width + 58), y = 300 + k * 54;
    g.save(); g.globalAlpha = .68 * fade;
    RRECT(W / 2 - w / 2, y - 24, w, 48, 24, 'rgba(10,11,15,.72)', 4);
    CIRC(W / 2 - w / 2 + 25, y, 5, '#e8b84c', 0);
    TXT(txt, W / 2 + 10, y + 10, size, '#d8d4ca', 'center', 600);
    g.restore();
  });
}
// footnote — set text in style.js via const FOOTNOTE_TEXT = '...' (empty = hidden)
function footnote() {
  const txt = typeof FOOTNOTE_TEXT !== 'undefined' ? FOOTNOTE_TEXT : '';
  if (!txt) return;
  TXT(txt, W / 2, 268, 22, 'rgba(255,255,255,.42)', 'center', 500);
}

// generic shot/render — SC comes from style.js: [[nextSceneFirstLine, sceneFn], ...] sorted ascending, ending with Infinity
function shot(t) {
  let li = 0, lp = 0, line = null, inside = false;
  for (let i = 0; i < L.length; i++) {
    if (t >= L[i].t0 && t < L[i].t0 + L[i].dur) { li = i; line = L[i]; lp = (t - L[i].t0) / L[i].dur; inside = true; break; }
    if (t >= L[i].t0) { li = i; line = L[i]; lp = 1; }
  }
  const k = SC.findIndex(([till]) => li < till);
  const from = k === 0 ? 0 : SC[k - 1][0];
  const g0 = L[from].t0, g1 = SC[k][0] < L.length ? L[SC[k][0]].t0 : TALK.dur;
  const p = Math.min(1, Math.max(0, (t - g0) / (g1 - g0)));
  const em = inside && line && line.env ? line.env[Math.min(line.env.length - 1, Math.floor(lp * line.env.length))] : 0;
  return { t, p, i: li, lp, line, em, fn: SC[k][1] };
}
function render(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.__t = t;
  const s = shot(t);
  s.fn(s);
  sourceChips(s);
  subs(s);
  footnote();
}
