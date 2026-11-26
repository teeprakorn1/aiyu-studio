/**
 * @fileoverview rig.js — reusable machinery for vertical documentary videos (1080x1920).
 *
 * NEVER edit per project. Per-project content lives in style.js
 * (characters CH, scenes sc*, scene table SC, FOOTNOTE_TEXT).
 *
 * Architecture: scenes are bound to dialogue line indices via SC, never to seconds,
 * so the entire film rescales automatically when audio tempo changes — everything
 * derives from the single generated talk.js (TALK).
 *
 * Key API for scene authors:
 * - {@link person} characters, {@link cam} camera, {@link mouthFor} lip sync
 * - primitives: TXT RRECT CIRC LIMB LINE SHAPE PATH
 * - scenery: wall floorY win glow city stars lamp rain circuitField rim vig tint
 * - cards: nameCard newsCard emailCard quoteCard pop chip chartCard
 *
 * Globals read at runtime (defined elsewhere): TALK (talk.js), SRCCHIPS (srchips.js),
 * CH + SC + FOOTNOTE_TEXT (style.js).
 */

const W = 1080, H = 1920, OL = '#1d1a17', OW = 9;
const g = document.getElementById('c').getContext('2d');
const L = TALK.lines;
const FONT = '"Kanit","Leelawadee UI",sans-serif';
const SUB_FRAME_MAX = 840, SUB_PAD_X = 24, SUB_STROKE = 10, SUB_TEXT_MAX = SUB_FRAME_MAX - SUB_PAD_X * 2 - SUB_STROKE;
const SUB_BASE = 52, SUB_MIN = 40, SUB_MAX_ROWS = 3;
const clamp01 = v => Math.min(1, Math.max(0, v));
const lerp = (a, b, p) => a + (b - a) * p;
const SEG_WORD = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
const SEG_GRAPH = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;

/* Drawing primitives — the vocabulary every scene is built from:
 * PATH(pts) polygon path · SHAPE(pts,fill) filled+outlined polygon · CIRC(x,y,r,fill,lw)
 * LIMB(x1,y1,x2,y2,w,fill) outlined round-cap segment · LINE(pts,w) polyline
 * RRECT(x,y,w,h,r,fill,lw) rounded rect · TXT(s,x,y,size,fill,align,weight) text (Kanit)
 * ease(p) cubic ease-out · clamp01(v) · lerp(a,b,p) */
const PATH = pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
const SHAPE = (pts, fill) => { PATH(pts); g.fillStyle = fill; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.lineJoin = 'round'; g.stroke(); };
const CIRC = (x, y, r, fill, lw = OW) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = OL; g.stroke(); } };
const LIMB = (x1, y1, x2, y2, w, fill) => { g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = OL; g.lineWidth = w + OW * 2; g.stroke(); g.strokeStyle = fill; g.lineWidth = w; g.stroke(); };
const LINE = (pts, w) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineCap = 'round'; g.lineWidth = w; g.strokeStyle = OL; g.stroke(); };
const RRECT = (x, y, w, h, r, fill, lw = OW) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = OL; g.stroke(); } };
const TXT = (s, x, y, size, fill, align = 'center', weight = 700) => { g.font = `${weight} ${size}px ${FONT}`; g.textAlign = align; g.fillStyle = fill; g.fillText(s, x, y); };
const ease = p => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);

const POSE = {
  idle: [[.14, .28], [.14, .28]],
  fold: [[.16, -2.65], [.16, -2.65]],
  point: [[.14, .28], [.8, .95]],
  open: [[.55, .9], [.55, .9]],
};


function hairBack(c) {
  if (c.hs === 'longF' || c.hs === 'bob' || c.hs === 'blonde') {
    const len = c.hs === 'longF' ? 300 : c.hs === 'blonde' ? 240 : 200;
    const wd = c.hs === 'longF' ? 172 : 224;
    if (c.hs === 'longF') {
      g.beginPath();
      g.moveTo(-wd / 2, -136); g.lineTo(wd / 2, -136); g.lineTo(wd / 2, -136 + len - 60);
      for (let i = 0; i < 3; i++) {
        const x0 = wd / 2 - i * (wd / 3), x1 = wd / 2 - (i + 1) * (wd / 3);
        g.quadraticCurveTo(x0 - wd / 12, -136 + len - 10, x1, -136 + len - 60);
      }
      g.closePath();
      g.fillStyle = c.hair; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
      LINE([[-wd / 2 + 18, -80], [-wd / 2 + 30, -136 + len - 80]], 7);
      LINE([[wd / 2 - 24, -60], [wd / 2 - 34, -136 + len - 90]], 7);
    } else {
      g.beginPath(); g.roundRect(-wd / 2, -136, wd, len, 58); g.fillStyle = c.hair; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
    }
  }
  if (c.hs === 'pony') {
    CIRC(58, -118, 42, c.hair); CIRC(58, -118, 42, null, OW);
    g.beginPath(); g.arc(34, -120, 30, -2.4, 1.2); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
  }
}
function hairFront(c) {
  const Hr = c.hair;
  if (c.hs === 'none') return;
  if (c.hs === 'jensen') {
    g.beginPath(); g.arc(0, -4, 102, Math.PI, 2 * Math.PI);
    g.quadraticCurveTo(40, -96, 104, -30); g.lineTo(104, -64);
    g.fillStyle = Hr; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.lineJoin = 'round'; g.stroke();
    g.beginPath();
    g.moveTo(-102, -6); g.quadraticCurveTo(-70, -118, 30, -104);
    g.quadraticCurveTo(88, -94, 102, -40); g.lineTo(104, -64);
    g.quadraticCurveTo(96, -136, 4, -140); g.quadraticCurveTo(-88, -142, -102, -40);
    g.closePath();
    g.fill(); g.stroke();
    LINE([[-40, -120], [-78, -66]], 8);
    LINE([[10, -124], [-10, -96]], 7);
    LINE([[52, -108], [74, -70]], 7);
    if (!c.young) {
      g.beginPath(); g.moveTo(-60, -118); g.quadraticCurveTo(-96, -84, -78, -28); g.quadraticCurveTo(-56, -60, -60, -118);
      g.fillStyle = '#a9abb0'; g.fill(); g.lineWidth = 6; g.strokeStyle = OL; g.stroke();
    } else {
      g.beginPath(); g.moveTo(-58, -118); g.quadraticCurveTo(-88, -84, -74, -34); g.quadraticCurveTo(-54, -62, -58, -118);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fill();
    }
    return;
  }
  if (c.hs === 'swoop') {
    g.beginPath(); g.arc(0, -4, 100, Math.PI * 1.02, Math.PI * 1.98);
    g.quadraticCurveTo(-50, -138, -98, -34); g.quadraticCurveTo(-60, -60, -30, -52);
    g.fillStyle = Hr; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
    LINE([[-64, -70], [30, -84]], 8);
    return;
  }
  g.beginPath(); g.arc(0, 0, 101, Math.PI, 2 * Math.PI); g.quadraticCurveTo(0, -78, -101, 0);
  g.fillStyle = Hr; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
  if (c.hs === 'longF') {
    g.beginPath();
    g.moveTo(-101, -10); g.quadraticCurveTo(-92, -108, 0, -112);
    g.quadraticCurveTo(92, -108, 101, -10);
    g.quadraticCurveTo(64, -52, 6, -34); g.quadraticCurveTo(0, -32, -6, -34);
    g.quadraticCurveTo(-64, -52, -101, -10);
    g.closePath();
    g.fillStyle = Hr; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
    LINE([[-78, -40], [-92, 42]], 9); LINE([[78, -40], [92, 42]], 9);
    LINE([[-30, -96], [-58, -52]], 6); LINE([[28, -94], [50, -50]], 6);
  }
  if (c.hs === 'bob' || c.hs === 'blonde') {
    LINE([[-84, -34], [-96, 52]], 10); LINE([[84, -34], [96, 52]], 10);
    if (c.hs === 'blonde') { g.beginPath(); g.arc(0, -6, 97, Math.PI * 1.1, Math.PI * 1.9); g.strokeStyle = Hr; g.lineWidth = 16; g.stroke(); }
  }
  if (c.hs === 'pony') {
    g.beginPath(); g.arc(0, -6, 99, Math.PI * 1.08, Math.PI * 1.92); g.strokeStyle = Hr; g.lineWidth = 18; g.stroke();
  }
}
function face(c, o) {
  const ex = 40, ey = 2, lk = o.look || 1, mood = o.mood || c.mood || 'neutral';
  const brow = {
    neutral: [-32, -35, 8], smile: [-31, -36, 8],
    worry: [-43, -28, 8], hurt: [-40, -24, 8],
    tense: [-22, -39, 10], resolute: [-26, -38, 9],
    shocked: [-50, -46, 9],
  }[mood] || [-32, -35, 8];
  for (const s of [-1, 1]) LINE([[s * 18, ey + brow[0]], [s * 63, ey + brow[1]]], brow[2]);
  if (c.glasses) {
    for (const s of [-1, 1]) {
      g.beginPath(); g.roundRect(s * ex - 38, ey - 30, 76, 58, 10);
      g.fillStyle = mood === 'shocked' ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.10)'; g.fill();
      g.lineWidth = 10; g.strokeStyle = OL; g.stroke();
      CIRC(s * ex + lk * 5, ey + (mood === 'shocked' ? 2 : 4), mood === 'shocked' ? 7 : 9, OL, 0);
      if (mood === 'shocked') CIRC(s * ex + lk * 5 - 3, ey - 1, 2.5, '#f4f1ea', 0);
      if (mood === 'tense' || mood === 'resolute') LINE([[s * ex - 26, ey - 12], [s * ex + 26, ey - 15]], 5);
    }
    LINE([[-6, ey - 4], [6, ey - 4]], 8);
    LINE([[-ex - 38, ey - 10], [-98, ey - 22]], 7); LINE([[ex + 38, ey - 10], [98, ey - 22]], 7);
  } else for (const s of [-1, 1]) {
    const X = s * ex;
    let slim = c.lashes ? 17 : 21;
    if (mood === 'tense') slim = 13;
    if (mood === 'hurt') slim = 15;
    if (mood === 'resolute') slim = 17;
    if (mood === 'shocked') slim = 27;
    if (o.blink) LINE([[X - 18, ey], [X + 18, ey]], 8);
    else {
      g.beginPath(); g.ellipse(X, ey, 19, slim, 0, 0, 7); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 6; g.strokeStyle = OL; g.stroke();
      CIRC(X + lk * 7, ey + 2, mood === 'shocked' ? 7 : 9, OL, 0);
      if (mood === 'shocked') CIRC(X + lk * 7 - 3, ey - 2, 2.5, '#f4f1ea', 0);
      if (mood === 'tense' || mood === 'resolute') LINE([[X - 17, ey - slim + 3], [X + 17, ey - slim + 1]], 5);
      if (c.lashes) { LINE([[X + s * 14, ey - 12], [X + s * 24, ey - 20]], 5); LINE([[X + s * 6, ey - 15], [X + s * 14, ey - 26]], 5); }
    }
  }
  g.beginPath(); g.moveTo(0, 14); g.quadraticCurveTo(10, 30, -4, 34); g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
  const my = 62, m = o.mouth || 0;
  if (mood === 'shocked') {
    g.beginPath(); g.ellipse(0, my + 2, 16, 22, 0, 0, 7); g.fillStyle = '#4a1e1e'; g.fill(); g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
  } else if (m > .08) {
    g.beginPath(); g.ellipse(0, my, 13, 8 + m * 8, 0, 0, 7); g.fillStyle = '#4a1e1e'; g.fill(); g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
  } else if (mood === 'smile') {
    g.beginPath(); g.moveTo(-18, my - 2); g.quadraticCurveTo(0, my + 12, 18, my - 2); g.lineWidth = 7; g.strokeStyle = OL; g.lineCap = 'round'; g.stroke();
    LINE([[-22, my - 8], [-16, my - 2]], 5); LINE([[22, my - 8], [16, my - 2]], 5);
  } else if (mood === 'resolute') {
    g.beginPath(); g.moveTo(-19, my + 2); g.quadraticCurveTo(0, my + 9, 20, my - 4); g.lineWidth = 7; g.strokeStyle = OL; g.lineCap = 'round'; g.stroke();
  } else if (mood === 'tense') {
    g.beginPath(); g.moveTo(-18, my + 2); g.lineTo(18, my + 1); g.lineWidth = 7; g.strokeStyle = OL; g.lineCap = 'round'; g.stroke();
    LINE([[-20, my + 2], [-15, my + 8]], 5); LINE([[20, my + 1], [15, my + 8]], 5);
  } else if (mood === 'hurt' || mood === 'worry') {
    g.beginPath(); g.moveTo(-14, my + 5); g.quadraticCurveTo(0, my - 5, 14, my + 5); g.lineWidth = 7; g.strokeStyle = OL; g.lineCap = 'round'; g.stroke();
  } else {
    g.beginPath(); g.moveTo(-15, my); g.quadraticCurveTo(0, my + 5, 15, my); g.lineWidth = 7; g.strokeStyle = OL; g.lineCap = 'round'; g.stroke();
  }
}
/**
 * Draw a character defined in CH.
 * @param {string} id - key of CH (e.g. 'host')
 * @param {object} o
 * @param {number} o.x - center x (feet baseline) @param {number} o.y - feet baseline y
 * @param {number} [o.scale=1] @param {number} o.t - time in seconds (drives idle bob)
 * @param {boolean} [o.flip] - mirror horizontally @param {boolean} [o.back] - back turned
 * @param {boolean} [o.walk] @param {boolean} [o.sit]
 * @param {number} [o.look=1] - facing direction -1..1
 * @param {boolean} [o.blink] - eyes closed this frame (e.g. (o.t % 3.4) < .12)
 * @param {string} [o.mood] - 'neutral'|'smile'|'worry'|'hurt'|'tense'|'resolute'
 * @param {number} [o.mouth] - mouth openness 0..1, use mouthFor() for lip sync
 * @param {string} [o.pose] - 'idle'|'fold'|'point'|'open' (or pass o.arms=[[a,b],[a,b]])
 */
function person(id, o) {
  const c = CH[id], t = o.t || 0, s = o.scale || 1, bw = c.bw || 1, bob = o.sit ? 0 : Math.sin(t * 2.1) * 3;
  g.save(); g.translate(o.x, o.y); g.scale(o.flip ? -s : s, s);
  if (!o.sit) { g.beginPath(); g.ellipse(0, 6, 108 * bw, 18, 0, 0, 7); g.fillStyle = 'rgba(0,0,0,.22)'; g.fill(); }
  const wv = o.walk ? Math.sin(t * 7) * 24 : 0;
  if (!o.sit) for (const sd of [-1, 1]) {
    const fx = sd * (44 * bw + wv);   // legs alternate: sd*(44bw+wv) — sd*(44bw+wv*sd) collapses to in-unison motion
    LIMB(sd * 38 * bw, -178, fx, -14, 52, c.bot || '#26262b');
    g.beginPath(); g.ellipse(fx + sd * 4, -6, 32, 13, 0, 0, 7); g.fillStyle = c.ghost ? c.top : '#20242c'; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
  }
  const TW = 106 * bw;
  if (c.dress) SHAPE([[-TW, -392], [TW, -392], [TW + 44, -160], [-TW - 44, -160]], c.top);
  else SHAPE([[-TW, -394], [TW, -394], [TW - 8, -178], [-TW + 8, -178]], c.top);
  if (c.jacket) {
    g.strokeStyle = '#3d3d45'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, -382); g.lineTo(0, -188); g.stroke();
    SHAPE([[-60, -394], [-10, -394], [-34, -332], [-68, -350]], '#28282e');
    SHAPE([[60, -394], [10, -394], [34, -332], [68, -350]], '#28282e');
    LINE([[-78, -392], [-52, -300]], 5); LINE([[78, -392], [52, -300]], 5);
    g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 8; g.beginPath(); g.moveTo(-84, -386); g.lineTo(-88, -220); g.stroke();
  }
  if (c.suit) {
    SHAPE([[-44, -394], [44, -394], [28, -296], [-28, -296]], '#f0eee7');
    SHAPE([[-15, -390], [15, -390], [21, -316], [0, -298], [-21, -316]], c.tie);
    SHAPE([[-60, -394], [-10, -394], [-36, -328], [-68, -348]], c.top);
    SHAPE([[60, -394], [10, -394], [36, -328], [68, -348]], c.top);
  }
  if (c.blazer) { g.strokeStyle = '#2b3442'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, -386); g.lineTo(0, -300); g.stroke(); }
  if (c.floral) for (const [fx, fy, fc] of [[-58, -238, '#d97a8a'], [34, -268, '#e8b84c'], [82, -208, '#d97a8a'], [-88, -196, '#e8b84c'], [58, -322, '#d97a8a'], [-30, -330, '#f0d5da'], [90, -300, '#f0d5da'], [-70, -280, '#d97a8a']]) CIRC(fx, fy, 10, fc, 4);
  g.fillStyle = c.skin; g.fillRect(-26, -428, 52, 46);
  const arms = o.arms || (o.pose ? POSE[o.pose] : POSE.idle);
  [-1, 1].forEach((side, k) => {
    const [a, b] = arms[k], sx = side * TW - side * 2, sy = -378;
    const ex = sx + side * 148 * Math.sin(a), ey = sy + 148 * Math.cos(a);
    const wx = ex + side * 134 * Math.sin(b), wy = ey + 134 * Math.cos(b);
    LIMB(sx, sy, ex, ey, 52, c.top); LIMB(ex, ey, wx, wy, 42, c.skin); CIRC(wx, wy, 25, c.skin);
  });
  g.translate(0, -488 + bob);
  hairBack(c);
  g.beginPath(); g.arc(0, 0, 98, 0, 7); g.fillStyle = o.back ? c.hair : c.skin; g.fill();
  if (!o.back && !c.ghost) { g.save(); g.clip(); g.beginPath(); g.arc(-24, -8, 96, 0, 7); g.fillStyle = 'rgba(0,0,0,.08)'; g.fill(); g.restore(); }
  g.beginPath(); g.arc(0, 0, 98, 0, 7); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
  hairFront(c);
  if (!o.back && c.earring) { CIRC(-96, 34, 9, c.earring, 5); CIRC(96, 34, 9, c.earring, 5); }
  if (o.back) { g.beginPath(); g.arc(-22, -16, 62, Math.PI * 1.15, Math.PI * 1.55); g.lineWidth = 12; g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineCap = 'round'; g.stroke(); }
  else if (!c.ghost) face(c, o);
  g.restore();
}

const rim = (x, y, s, side = 1, col = 'rgba(180,200,255,.28)') => {
  g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = col; g.lineWidth = 14; g.lineCap = 'round';
  g.beginPath(); g.arc(side * 70, -440, 90, side > 0 ? -1.2 : Math.PI + .4, side > 0 ? .9 : Math.PI + 1.5); g.stroke();
  g.beginPath(); g.arc(side * 60, -300, 120, side > 0 ? -1.1 : Math.PI + .5, side > 0 ? .6 : Math.PI + 1.4); g.stroke();
  g.restore();
};

const vig = () => {
  const v = g.createRadialGradient(W / 2, H * .55, H * .28, W / 2, H * .55, H * .75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.34)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
};
const tint = (c, a) => { g.fillStyle = `rgba(${c},${a})`; g.fillRect(0, 0, W, H); };
const zoom = (o, fn, z0, z1, cx = W / 2, cy = H * .6) => {
  const z = z0 + (z1 - z0) * ease(o.p);
  g.save(); g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy); fn(); g.restore();
};
/**
 * Camera transform: slow zoom across the scene + punch kick on new lines + drift.
 * Wrap background and characters inside fn; keep headings/cards outside if they
 * should not move with the camera.
 * ⚠ positions inside cam are shifted by zoom: actual = cy + (val - cy) * z — see safe zones.
 * @param {object} o - scene object passed to the scene function
 * @param {object} cfg
 * @param {number} [cfg.z0=1.045] - zoom at scene start @param {number} [cfg.z1=1.085] - zoom at end
 * @param {number} [cfg.cx=W/2] @param {number} [cfg.cy=H*.58] - zoom center (cy is safe-zone critical)
 * @param {number} [cfg.punch=.022] - zoom kick intensity at each new line
 * @param {number} [cfg.driftX=6] @param {number} [cfg.driftY=4] - slow float amplitude
 * @param {number} [cfg.x0] [cfg.x1] [cfg.y0] [cfg.y1] - pan offsets over scene progress
 * @param {function} fn - draw callback executed inside the camera transform
 */
function cam(o, cfg, fn) {
  const q = ease(o.p), z0 = cfg.z0 ?? 1.045, z1 = cfg.z1 ?? 1.085;
  const elapsed = o.lp * ((o.line && o.line.dur) || 4);
  const punch = (cfg.punch ?? .022) * clamp01(1 - elapsed / (cfg.punchDur || .55));
  const z = lerp(z0, z1, q) + punch;
  const px = lerp(cfg.x0 ?? 0, cfg.x1 ?? 0, q) + Math.sin(o.t * (cfg.swx ?? .22) + (cfg.phase ?? 0)) * (cfg.driftX ?? 6);
  const py = lerp(cfg.y0 ?? 0, cfg.y1 ?? 0, q) + Math.cos(o.t * (cfg.swy ?? .17) + (cfg.phase ?? 0)) * (cfg.driftY ?? 4);
  const cx = cfg.cx ?? W / 2, cy = cfg.cy ?? H * .58;
  g.save(); g.translate(cx + px, cy + py); g.scale(z, z); g.translate(-cx, -cy); fn(); g.restore();
}
function rain(alpha = .18, n = 34) {
  const t = g.__t || 0;
  g.save(); g.globalAlpha = alpha; g.strokeStyle = '#9fb5c9'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = (i * 157 + t * 34) % (W + 180) - 90, y = (i * 241 + t * 190) % 1350;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 18, y + 54); g.stroke();
  }
  g.restore();
}
function circuitField(alpha = .13, col = '118,185,0') {
  g.save(); g.globalAlpha = alpha; g.strokeStyle = `rgba(${col},.8)`; g.fillStyle = `rgba(${col},.9)`; g.lineWidth = 5; g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const x = 60 + (i * 181) % 920, y = 150 + (i * 263) % 1160, dx = 50 + (i * 37) % 80, dy = 42 + (i * 29) % 72;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y); g.lineTo(x + dx, y + dy); g.stroke();
    g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.beginPath(); g.arc(x + dx, y + dy, 7, 0, 7); g.fill();
  }
  g.restore();
}

const wall = (a, b) => { const w = g.createLinearGradient(0, 0, 0, H); w.addColorStop(0, a); w.addColorStop(1, b); g.fillStyle = w; g.fillRect(0, 0, W, H); };
const floorY = (y, c) => { g.fillStyle = c; g.fillRect(0, y, W, H - y); LINE([[0, y], [W, y]], 6); };
const win = (x, y, w, h, sky, div = 2) => {
  RRECT(x, y, w, h, 8, '#20242c');
  g.fillStyle = sky; g.fillRect(x + 10, y + 10, w - 20, h - 20);
  g.strokeStyle = OL; g.lineWidth = 6;
  for (let i = 1; i < div; i++) { g.beginPath(); g.moveTo(x + w * i / div, y); g.lineTo(x + w * i / div, y + h); g.stroke(); }
  g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
};
const glow = (x, y, r, c = '255,220,140', a = .7) => {
  const s = g.createRadialGradient(x, y, 0, x, y, r);
  s.addColorStop(0, `rgba(${c},${a})`); s.addColorStop(1, `rgba(${c},0)`);
  g.fillStyle = s; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
};
const city = (x, y, w, h, n, c) => {
  for (let i = 0; i < n; i++) {
    const bx = x + (i * 73 % w), bh = 20 + (i * 97 % Math.max(30, h - 40));
    g.fillStyle = c; g.fillRect(bx, y + h - bh, 34 + (i * 41 % 40), bh);
  }
};
const stars = n => { for (let i = 0; i < n; i++) CIRC((i * 197) % W, 60 + (i * 131) % 700, 2.5, 'rgba(255,255,255,.75)', 0); };
const lamp = (x, y, s = 1) => {
  LINE([[x, y], [x, y - 330 * s]], 10);
  g.beginPath(); g.moveTo(x, y - 330 * s); g.quadraticCurveTo(x + 60 * s, y - 350 * s, x + 60 * s, y - 300 * s);
  g.lineWidth = 9; g.strokeStyle = OL; g.stroke();
  CIRC(x + 60 * s, y - 285 * s, 20, '#c94f3d'); glow(x + 60 * s, y - 285 * s, 110, '255,120,80', .55);
};

/**
 * Caption card with a small character portrait — for introducing people.
 * @param {number} x @param {number} y @param {number} w
 * @param {string} id - CH character id for the portrait
 * @param {string} cap - name text @param {string} sub - subtitle/role @param {number} [p=1]
 */
function nameCard(x, y, w, id, cap, sub, p = 1) {
  const e = ease(p); if (!e) return;
  const h = w * 1.34, c = CH[id];
  g.save(); g.translate(x, y); g.rotate(.045); g.scale(e, e); g.globalAlpha = e;
  g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 20; g.shadowOffsetY = 8;
  RRECT(-w / 2, -h / 2, w, h, 12, '#f4f1ea'); g.shadowColor = 'transparent';
  g.save(); g.beginPath(); g.roundRect(-w / 2 + 18, -h / 2 + 18, w - 36, w * .8, 8); g.clip();
  g.fillStyle = '#24303a'; g.fillRect(-w / 2 + 18, -h / 2 + 18, w - 36, w * .8);
  g.translate(0, -h / 2 + w * .66); g.scale(.52, .52);
  hairBack(c);
  g.beginPath(); g.arc(0, 0, 98, 0, 7); g.fillStyle = c.skin; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
  hairFront(c); face(c, { look: 1 });
  g.restore();
  g.beginPath(); g.roundRect(-w / 2 + 18, -h / 2 + 18, w - 36, w * .8, 8); g.lineWidth = 6; g.strokeStyle = OL; g.stroke();
  TXT(cap, 0, h / 2 - 82, 38, '#2a2420');
  TXT(sub, 0, h / 2 - 36, 26, '#7a3020');
  g.restore();
}
/**
 * Newspaper-style card prop.
 * @param {number} x @param {number} y @param {number} w - width @param {number} rot - rotation radians
 * @param {string} head - headline text @param {number} [p=1] - reveal progress
 */
function newsCard(x, y, w, rot, head, p = 1) {
  const e = ease(p); if (!e) return;
  const h = w * .8;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(e, e); g.globalAlpha = e;
  g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 16; g.shadowOffsetY = 6;
  RRECT(-w / 2, -h / 2, w, h, 8, '#efece4'); g.shadowColor = 'transparent';
  TXT(head, 0, -h / 2 + 52, 40, '#2a2420', 'center', 800);
  g.strokeStyle = '#9aa0a8'; g.lineWidth = 4;
  for (let i = 0; i < 4; i++) { const yy = -h / 2 + 90 + i * 38; g.beginPath(); g.moveTo(-w / 2 + 22, yy); g.lineTo(w / 2 - 22, yy); g.stroke(); }
  g.restore();
}
/**
 * Email memo card with a diagonal red stamp overlay.
 * @param {number} x @param {number} y - center position @param {number} w - card width @param {number} [p=1] - 0..1 pop-in progress
 * @param {object} [opts] @param {string} [opts.to='To: all employees'] - header line @param {string} [opts.stamp='LEAKED'] - red stamp text
 */
function emailCard(x, y, w, p = 1, opts = {}) {
  const { to = 'To: all employees', stamp = 'LEAKED' } = opts;
  const e = ease(p); if (!e) return;
  const h = w * 1.05;
  g.save(); g.translate(x, y); g.scale(e, e); g.globalAlpha = e;
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 26; g.shadowOffsetY = 12;
  RRECT(-w / 2, -h / 2, w, h, 14, '#faf6ee'); g.shadowColor = 'transparent';
  RRECT(-w / 2, -h / 2, w, 90, 14, '#2c3038');
  TXT(to, 0, -h / 2 + 58, 34, '#e8dede', 'center', 600);
  g.strokeStyle = '#a9aeb6'; g.lineWidth = 5;
  for (let i = 0; i < 7; i++) { const yy = -h / 2 + 140 + i * 46; g.beginPath(); g.moveTo(-w / 2 + 34, yy); g.lineTo(w / 2 - 34, yy); g.stroke(); }
  g.save(); g.rotate(-.12);
  g.lineWidth = 7; g.strokeStyle = '#a83232'; g.strokeRect(-170, -40, 340, 92);
  TXT(stamp, 0, 22, 40, '#a83232', 'center', 800);
  g.restore(); g.restore();
}
/**
 * Large quotation text block, fading in with progress p.
 * @param {string[]} lines - one entry per row @param {number} p - 0..1 @param {number} [y=900]
 */
function quoteCard(lines, p, y = 900) {
  const e = ease(p); if (!e) return;
  g.save(); g.globalAlpha = e;
  RRECT(90, y - 60, 900, 120 + lines.length * 96, 26, 'rgba(16,12,14,.9)');
  g.lineWidth = 8; g.strokeStyle = '#a83232'; g.stroke();
  lines.forEach((s, i) => TXT(s, W / 2, y + 40 + i * 92, 54, i ? '#e8dede' : '#e05252', 'center', 800));
  g.restore();
}
/**
 * Big hook text that pops in with progress p (0..1) — cold-open pattern.
 * @param {string} txt @param {number} x @param {number} y - baseline
 * @param {string} color @param {number} p - reveal progress (use Math.min(1, o.p * k))
 * @param {number} [size=110]
 */
function pop(txt, x, y, color, p, size = 110) {
  const e = ease(p); if (!e) return;
  const s = e * (1.18 - .18 * e);
  g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = e;
  g.font = `900 ${size}px ${FONT}`; g.textAlign = 'center';
  g.lineWidth = 14; g.strokeStyle = OL; g.strokeText(txt, 0, 0);
  g.fillStyle = color; g.fillText(txt, 0, 0);
  g.restore();
}
/**
 * Small dark pill label with text.
 * @param {string} txt @param {number} x @param {number} y @param {string} color @param {number} [size=30]
 */
function chip(txt, x, y, color, size = 30) {
  g.font = `700 ${size}px ${FONT}`; const w = g.measureText(txt).width + 56;
  RRECT(x - w / 2, y - 30, w, 60, 30, 'rgba(20,18,16,.88)', 6);
  TXT(txt, x, y + 12, size, color);
}

/**
 * Line-chart card. Points are normalized [px, py] pairs in 0..1 (py=0 is the top).
 * @param {number} x @param {number} y - card center @param {number} w @param {number} h
 * @param {Array<[number,number]>} pts - e.g. [[0,.9],[.5,.4],[1,.05]] for a rising chart
 * @param {string} col - line color @param {string} label @param {string} [labCol]
 */
function chartCard(x, y, w, h, pts, col, label, labCol = '#e8dede') {
  RRECT(x - w / 2, y - h / 2, w, h, 14, 'rgba(14,16,22,.92)');
  g.lineWidth = 7; g.strokeStyle = OL; g.stroke();
  g.strokeStyle = col; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(x - w / 2 + 40 + px * (w - 80), y - h / 2 + 40 + py * (h - 100)) : g.moveTo(x - w / 2 + 40 + px * (w - 80), y - h / 2 + 40 + py * (h - 100))); g.stroke();
  TXT(label, x, y + h / 2 - 30, 34, labCol, 'center', 800);
}

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
window.rv = (o, n, r = 1.7) => o.i < n ? 0 : o.i === n ? Math.min(1, o.lp * r) : 1;
const ms = o => o.em * 1.6;
/** Mouth openness for one character: envelope only while lines carry this spk, else 0.
 *  Always use this for lip sync — feeding o.em directly makes every character chew along.
 *  @param {string} who - single-letter speaker id matching spk in dialogue.txt
 *  @param {object} o - scene object @returns {number} 0..1 mouth openness */
const mouthFor = (who, o) => (o.line && o.line.spk === who ? ms(o) : 0);
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
