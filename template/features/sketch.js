/**
 * @file features/sketch.js — hand-drawn sketch annotations — sketchLine/sketchRect/sketchCircle/sketchArrow/sketchUnderline.
 * Part of the aiyu template runtime. Layer rules: core ← features ← story.
 * Technique adopted from rough.js (see docs/acknowledgements.md), written natively on srnd —
 * zero dependencies, every primitive a pure function of (coords, seed, optional t).
 */

(() => {

/* The hand-drawn recipe, distilled: stroke twice with endpoints jittered perpendicular
 * (offsets ~1-2px at roughness 1) and a slight bow along the length (1-4%). The second
 * pass at reduced alpha is the pencil-double-stroke tell. Magnitudes follow rough.js's
 * proven ratios — larger reads as glitch, smaller reads as aliasing. */

/** Resolve the effective seed, applying boil quantization when enabled.
 * boil>0 re-seeds every `boil` frames — squigglevision that stays a pure function of t. */
function effSeed(seed, boil, t) {
  return boil > 0 && typeof t === 'number' ? seed + Math.floor(t * 30 / boil) : seed;
}

/** Jittered polyline points along a segment — the core primitive (pure, unit-testable).
 * @param {number} x1,y1,x2,y2 - endpoints (px)
 * @param {number} seed - role-derived seed (NEVER frame-derived — parallel-chunk law)
 * @param {number} rough - roughness multiplier, 1 = subtle hand shake (offsets ~1-2px)
 * @param {number} bow - bowing multiplier, 1 = gentle warp (~2% of length)
 * @param {number} passes - which pass (0/1) — pass 1 uses offset seeds for the double-stroke
 * @returns {number[]} flat [x,y,...] polyline, deterministic per (coords, seed, rough, bow, pass) */
function sketchPts(x1, y1, x2, y2, seed, rough, bow, pass) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;                 // perpendicular unit
  const segs = Math.max(2, Math.min(8, Math.round(len / 60)));
  const off = rough * 1.7, bowAmp = bow * len * 0.02;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const p = i / segs;
    const endFade = Math.sin(p * Math.PI);             // endpoints stay pinned-ish
    const j = (srnd(seed * 31 + pass * 977 + i * 13) - 0.5) * 2 * off;
    const b = (srnd(seed * 17 + pass * 571 + 7) - 0.5) * 2 * bowAmp * endFade;
    pts.push(x1 + dx * p + nx * (j + b), y1 + dy * p + ny * (j + b));
  }
  // endpoints: small jitter even at the ends (hand-drawn lines rarely meet exactly)
  pts[0] = x1 + (srnd(seed * 7 + pass) - 0.5) * off;
  pts[1] = y1 + (srnd(seed * 11 + pass) - 0.5) * off;
  pts[pts.length - 2] = x2 + (srnd(seed * 13 + pass) - 0.5) * off;
  pts[pts.length - 1] = y2 + (srnd(seed * 19 + pass) - 0.5) * off;
  return pts;
}

function strokePts(pts, color, width, alpha) {
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
  g.restore();
}

function drawSketchPts(pts0, pts1, o) {
  strokePts(pts0, o.color, o.width, 0.9);
  strokePts(pts1, o.color, Math.max(0.5, o.width * 0.7), 0.5);   // the pencil double-stroke
}

function normOpts(o) {
  o = o || {};
  return {
    seed: (o.seed || 0) * 1, rough: o.rough != null ? o.rough : 1, bow: o.bow != null ? o.bow : 1,
    width: o.width != null ? o.width : 2, color: o.color || (g.strokeStyle || '#fff'),
    boil: o.boil || 0, t: o.t,
  };
}

/** Hand-drawn line. seed MUST derive from the shape's role, never the frame. */
function sketchLine(x1, y1, x2, y2, opts) {
  const o = normOpts(opts);
  const s = effSeed(o.seed, o.boil, o.t);
  drawSketchPts(sketchPts(x1, y1, x2, y2, s, o.rough, o.bow, 0), sketchPts(x1, y1, x2, y2, s, o.rough, o.bow, 1), o);
}

/** Hand-drawn rectangle frame — corners overshoot slightly (the hand-drawn tell). */
function sketchRect(x, y, w, h, opts) {
  const o = normOpts(opts);
  const s = effSeed(o.seed, o.boil, o.t);
  const ov = 2 * o.rough;
  const corners = [
    [x - ov * srnd(s + 1), y, x + w, y], [x + w, y, x + w, y + h],
    [x + w + ov * srnd(s + 2), y + h, x, y + h], [x, y + h, x, y - ov * srnd(s + 3)],
  ];
  corners.forEach((c, i) => {
    drawSketchPts(
      sketchPts(c[0], c[1], c[2], c[3], s + i * 101, o.rough, o.bow, 0),
      sketchPts(c[0], c[1], c[2], c[3], s + i * 101, o.rough, o.bow, 1), o);
  });
}

/** Hand-drawn circle/ellipse — THE emphasis-circle primitive. Starts/ends slightly past
 * a full turn (overlap tell), radius wobbles by seeded offsets. */
function sketchCircle(cx, cy, r, opts) {
  const o = normOpts(opts);
  const s = effSeed(o.seed, o.boil, o.t);
  const ry = (opts && opts.ry) || r;
  for (let pass = 0; pass < 2; pass++) {
    const pts = [];
    const n = Math.max(16, Math.min(40, Math.round(r / 3)));
    const sweep = Math.PI * 2 * (1.02 + srnd(s + pass * 31) * 0.06);   // slight overlap
    const a0 = srnd(s + pass * 7) * Math.PI * 2;
    for (let i = 0; i <= n; i++) {
      const a = a0 + sweep * i / n;
      const wob = 1 + (srnd(s * 3 + pass * 811 + i * 29) - 0.5) * 0.05 * o.rough;
      pts.push(cx + Math.cos(a) * r * wob, cy + Math.sin(a) * ry * wob);
    }
    strokePts(pts, o.color, pass ? Math.max(0.5, o.width * 0.7) : o.width, pass ? 0.5 : 0.9);
  }
}

/** Hand-drawn arrow — jittered shaft + two head strokes. */
function sketchArrow(x1, y1, x2, y2, opts) {
  const o = normOpts(opts);
  const s = effSeed(o.seed, o.boil, o.t);
  sketchLine(x1, y1, x2, y2, opts);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const hl = Math.max(10, Math.min(26, Math.hypot(x2 - x1, y2 - y1) * 0.22));
  for (const side of [-1, 1]) {
    const a = ang + Math.PI + side * (0.42 + srnd(s + side * 5) * 0.1);
    sketchLine(x2, y2, x2 + Math.cos(a) * hl, y2 + Math.sin(a) * hl, Object.assign({}, opts, { seed: s + side * 37 }));
  }
}

/** Hand-drawn underline — single-pass-ish bowed line for text emphasis. */
function sketchUnderline(x, y, w, opts) {
  const o = normOpts(opts);
  o.bow = o.bow * 1.6;
  const s = effSeed(o.seed, o.boil, o.t);
  drawSketchPts(sketchPts(x, y, x + w, y, s, o.rough, o.bow, 0), sketchPts(x, y, x + w, y, s, o.rough, o.bow, 1), o);
}

Object.assign(globalThis, { sketchLine, sketchRect, sketchCircle, sketchArrow, sketchUnderline, sketchPts });
})();
