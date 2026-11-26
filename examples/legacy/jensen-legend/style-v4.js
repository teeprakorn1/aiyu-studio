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

const PATH = pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
const SHAPE = (pts, fill) => { PATH(pts); g.fillStyle = fill; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.lineJoin = 'round'; g.stroke(); };
const CIRC = (x, y, r, fill, lw = OW) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = OL; g.stroke(); } };
const LIMB = (x1, y1, x2, y2, w, fill) => { g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = OL; g.lineWidth = w + OW * 2; g.stroke(); g.strokeStyle = fill; g.lineWidth = w; g.stroke(); };
const LINE = (pts, w) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineCap = 'round'; g.lineWidth = w; g.strokeStyle = OL; g.stroke(); };
const RRECT = (x, y, w, h, r, fill, lw = OW) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = OL; g.stroke(); } };
const TXT = (s, x, y, size, fill, align = 'center', weight = 700) => { g.font = `${weight} ${size}px ${FONT}`; g.textAlign = align; g.fillStyle = fill; g.fillText(s, x, y); };
const ease = p => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);

const CH = {
  jensen: { skin: '#d9a06e', hair: '#7d8087', top: '#1c1c20', bot: '#25262c', hs: 'jensen', jacket: true, glasses: true },
  youngJensen: { skin: '#dda06f', hair: '#25211e', top: '#202126', bot: '#26262c', hs: 'jensen', jacket: true, young: true },
  alice: { skin: '#e6b18a', hair: '#3a2418', top: '#a83246', hs: 'longF', dress: true, floral: true, lashes: true, earring: '#e8c46a' },
  lori: { skin: '#e8bf9a', hair: '#6e6257', top: '#5d6d7e', hs: 'bob', lashes: true, mood: 'hurt' },
  kress: { skin: '#ecc39e', hair: '#d5b36a', top: '#37465a', hs: 'blonde', blazer: true, lashes: true },
  trump: { skin: '#e8b88a', hair: '#e6c257', top: '#26365a', hs: 'swoop', suit: true, tie: '#a83030', bw: 1.14 },
  madison: { skin: '#e8bf9a', hair: '#2a2018', top: '#7a5a8a', hs: 'pony', lashes: true },
  shadow: { skin: '#16131a', hair: '#16131a', top: '#16131a', bot: '#16131a', hs: 'none', ghost: true },
};

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
function person(id, o) {
  const c = CH[id], t = o.t || 0, s = o.scale || 1, bw = c.bw || 1, bob = o.sit ? 0 : Math.sin(t * 2.1) * 3;
  g.save(); g.translate(o.x, o.y); g.scale(o.flip ? -s : s, s);
  if (!o.sit) { g.beginPath(); g.ellipse(0, 6, 108 * bw, 18, 0, 0, 7); g.fillStyle = 'rgba(0,0,0,.22)'; g.fill(); }
  const wv = o.walk ? Math.sin(t * 7) * 24 : 0;
  if (!o.sit) for (const sd of [-1, 1]) {
    const fx = sd * (44 * bw + wv * sd);
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
function paperSheet(x, y, w, h, rot, p = 1, stamp = '') {
  const e = ease(p); if (!e) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(e, e); g.globalAlpha = e;
  g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 14; g.shadowOffsetY = 6;
  RRECT(-w / 2, -h / 2, w, h, 8, '#f2eee4'); g.shadowColor = 'transparent';
  SHAPE([[w / 2 - 42, -h / 2], [w / 2, -h / 2 + 42], [w / 2, -h / 2]], '#d8d1c2');
  g.strokeStyle = '#9aa0a8'; g.lineWidth = 4;
  for (let i = 0; i < Math.floor(h / 42) - 1; i++) {
    const yy = -h / 2 + 42 + i * 38;
    g.beginPath(); g.moveTo(-w / 2 + 24, yy); g.lineTo(w / 2 - 24, yy); g.stroke();
  }
  if (stamp) {
    g.save(); g.rotate(-.13); g.lineWidth = 5; g.strokeStyle = '#a83232'; g.strokeRect(-w * .32, -24, w * .64, 58);
    TXT(stamp, 0, 14, 30, '#a83232', 'center', 800); g.restore();
  }
  g.restore();
}
function wallClock(x, y, r, t) {
  CIRC(x, y, r, '#e8e2d2'); CIRC(x, y, r, null, 8);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, x1 = x + Math.sin(a) * r * .78, y1 = y - Math.cos(a) * r * .78;
    const x2 = x + Math.sin(a) * r * .9, y2 = y - Math.cos(a) * r * .9;
    LINE([[x1, y1], [x2, y2]], i % 3 ? 3 : 5);
  }
  const ma = t * .42, ha = t * .07 - .8;
  LINE([[x, y], [x + Math.sin(ha) * r * .45, y - Math.cos(ha) * r * .45]], 8);
  LINE([[x, y], [x + Math.sin(ma) * r * .68, y - Math.cos(ma) * r * .68]], 5);
  CIRC(x, y, 8, '#a83232', 4);
}
function routeCurve(pts, color = '#e8b84c', width = 7) {
  g.save(); g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.setLineDash([18, 16]); g.lineDashOffset = -(g.__t || 0) * 22;
  g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  g.restore();
}
function cargoShip(x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  SHAPE([[-120, 0], [120, 0], [84, 44], [-88, 44]], '#26384e');
  RRECT(-78, -52, 52, 52, 4, '#a83232'); RRECT(-20, -52, 52, 52, 4, '#e8b84c'); RRECT(38, -52, 52, 52, 4, '#3f6d9e');
  LINE([[-100, 44], [100, 44]], 6);
  g.restore();
}
function serverRack(x, y, w, h, tintCol = '#76b900') {
  RRECT(x, y, w, h, 8, '#151a24');
  const rows = Math.floor(h / 58);
  for (let i = 0; i < rows; i++) {
    RRECT(x + 12, y + 14 + i * 58, w - 24, 40, 4, '#242b36', 4);
    for (let k = 0; k < 3; k++) CIRC(x + 34 + k * 22, y + 34 + i * 58, 5, k ? '#3f9e5a' : tintCol, 0);
    g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(x + w - 58, y + 25 + i * 58, 32, 8);
  }
}
function docBadge(txt, x, y, color = '#e8b84c', p = 1) {
  const e = ease(p); if (!e) return;
  g.save(); g.globalAlpha = e; g.translate(x, y); g.rotate(-.04);
  RRECT(-170, -42, 340, 84, 12, 'rgba(18,18,24,.9)', 6);
  g.lineWidth = 4; g.strokeStyle = color; g.stroke();
  TXT(txt, 0, 13, 30, color, 'center', 800);
  g.restore();
}

/* ---------- drawn backgrounds 1080x1920 ---------- */
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
function bgHQ() {
  wall('#0a1424', '#1b2b44');
  stars(14);
  CIRC(840, 200, 66, '#e8e2d2'); CIRC(818, 182, 58, '#0a1424', 0);
  g.fillStyle = '#101827'; g.fillRect(0, 1480, W, 440);
  const bx = W / 2;
  RRECT(bx - 300, 560, 600, 940, 6, '#202a3d');
  RRECT(bx - 300, 560, 600, 940, 6, null, OW);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 7; c++) {
    const flicker = Math.sin((g.__t || 0) * .7 + r * 1.7 + c * .9) * .08;
    g.fillStyle = (r * 13 + c * 7) % 5 < 2 ? `rgba(255,228,150,${.58 + flicker})` : '#151c2a';
    g.fillRect(bx - 258 + c * 76, 610 + r * 92, 44, 54);
  }
  LINE([[bx, 560], [bx, 485]], 8); CIRC(bx, 480, 9, '#c94f3d', 4);
  glow(bx, 990, 250, '118,185,0', .52);
  RRECT(bx - 205, 910, 410, 88, 10, '#0f1a10');
  TXT('NVIDIA', bx, 972, 58, '#76b900', 'center', 800);
  vig();
}
function bgDesk() {
  wall('#332b28', '#1d181b');
  win(300, 220, 480, 560, '#101c2e');
  city(315, 620, 450, 150, 8, '#1a2838');
  for (const [x, y] of [[380, 640], [500, 600], [620, 660], [700, 560]]) glow(x, y, 9, '255,200,120', .9);
  SHAPE([[820, 1080], [900, 1080], [884, 1130], [836, 1130]], '#2c2620');
  LINE([[860, 830], [860, 1080]], 8);
  glow(860, 1150, 320);
  floorY(1420, '#4a3428');
  vig();
}
function bgDiner() {
  wall('#3d2c22', '#241812');
  win(140, 200, 800, 520, '#0d1626', 3);
  city(160, 560, 760, 150, 10, '#16232f');
  for (const [x, y] of [[300, 560], [500, 520], [700, 580], [840, 480]]) glow(x, y, 9, '255,170,90', .8);
  RRECT(190, 90, 700, 80, 40, '#1e2a1e');
  TXT('DINER · 24 HR', 540, 148, 52, '#7ed69a', 'center', 800);
  g.globalAlpha = .3 + .12 * Math.sin(g.__t || 0); TXT('OPEN', 540, 148, 0, '#000', 'center', 0); g.globalAlpha = 1;
  floorY(1460, '#3a2418');
  vig();
}
function bgLobby() {
  wall('#d8d2c6', '#aea594');
  win(120, 200, 380, 620, '#cfe6f0', 2);
  win(580, 200, 380, 620, '#cfe6f0', 2);
  city(140, 600, 340, 200, 7, '#9fb9c9');
  city(600, 600, 340, 200, 7, '#9fb9c9');
  floorY(1400, '#cfc6b8');
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 1400, W, 80);
  vig();
}
function bgExpo() {
  wall('#0a0c14', '#161a28');
  for (const cx of [300, 780]) {
    g.save(); g.globalAlpha = .12; g.fillStyle = '#cfe0ff';
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx - 180, 900); g.lineTo(cx + 180, 900); g.fill(); g.restore();
  }
  glow(540, 560, 420, '118,185,0', .32);
  RRECT(140, 300, 800, 360, 14, '#10202e');
  TXT('COMPUTEX', 540, 470, 78, '#76b900', 'center', 800);
  TXT('TAIPEI', 540, 530, 38, '#cfe0d0', 'center', 700);
  floorY(1440, '#14161f');
  for (let x = 0; x < W; x += 95) { g.beginPath(); g.arc(x + 45, 1480, 46, Math.PI, 0); g.fillStyle = '#0a0b10'; g.fill(); }
  vig();
}
function bgDinnerV() {
  wall('#433026', '#271a12');
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 4;
  for (let y = 200; y < 1300; y += 110) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  win(620, 240, 360, 420, '#0d1626', 2);
  for (const [x, y] of [[700, 480], [800, 430], [920, 500], [660, 380]]) glow(x, y, 10, '255,170,90', .9);
  for (const x of [240, 840]) {
    LINE([[x, 0], [x, 200]], 7);
    SHAPE([[x - 55, 200], [x + 55, 200], [x + 38, 260], [x - 38, 260]], '#1e1a16');
    glow(x, 280, 170);
  }
  floorY(1460, '#3a2418');
  vig();
}
function bgAlley() {
  wall('#06090f', '#111624');
  for (const [x, w] of [[-30, 330], [780, 330]]) {
    g.fillStyle = '#10141e'; g.fillRect(x, 260, w, 1100);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 3; c++)
      if ((r * 5 + c * 3) % 4 === 0) { g.fillStyle = 'rgba(255,190,110,.55)'; g.fillRect(x + 40 + c * 96, 320 + r * 120, 42, 54); }
  }
  floorY(1400, '#12141c');
  g.beginPath(); g.ellipse(540, 1500, 320, 64, 0, 0, 7); g.fillStyle = 'rgba(255,210,140,.13)'; g.fill();
  lamp(140, 1400, 1); lamp(820, 1400, .85);
  const f = g.createLinearGradient(0, 1000, 0, 1500);
  f.addColorStop(0, 'rgba(120,140,180,0)'); f.addColorStop(1, 'rgba(120,140,180,.16)');
  g.fillStyle = f; g.fillRect(0, 1000, W, 500);
  vig();
}
function bgOffice() {
  wall('#c6bfb2', '#9d9589');
  win(90, 200, 900, 360, '#cfe0ea', 4);
  city(110, 400, 860, 150, 14, '#93aab8');
  for (const [x, w] of [[90, 300], [640, 320]]) {
    SHAPE([[x, 1180], [x + w, 1180], [x + w, 1400], [x, 1400]], '#6a5a48');
    RRECT(x + 40, 1040, 150, 140, 8, '#20242c');
    g.fillStyle = 'rgba(140,200,255,.5)'; g.fillRect(x + 52, 1052, 126, 116);
  }
  floorY(1400, '#b0a698');
  vig();
}
function bgBoard() {
  wall('#2a2e36', '#1a1d24');
  win(90, 180, 900, 400, '#c8d8e4', 4);
  city(110, 400, 860, 170, 13, '#7d93a4');
  RRECT(290, 220, 500, 280, 12, '#10151c');
  g.strokeStyle = '#76b900'; g.lineWidth = 10; g.lineCap = 'round';
  g.beginPath(); g.moveTo(330, 440); g.lineTo(410, 400); g.lineTo(480, 420); g.lineTo(560, 360); g.lineTo(640, 300); g.lineTo(720, 268); g.stroke();
  floorY(1560, '#3a3f4a');
  vig();
}
function bgHome() {
  wall('#d6cec0', '#b2a698');
  win(560, 200, 400, 520, '#f2ddb8');
  glow(760, 480, 280);
  RRECT(110, 1240, 500, 160, 24, '#5d6d7e');
  RRECT(130, 1180, 190, 90, 20, '#6a7c8e'); RRECT(360, 1180, 190, 90, 20, '#6a7c8e');
  RRECT(180, 320, 190, 140, 8, '#8a6a4a');
  g.fillStyle = '#c9d4dc'; g.fillRect(195, 335, 160, 110);
  LINE([[205, 430], [250, 385], [285, 415], [340, 372]], 8);
  LINE([[960, 1100], [960, 1400]], 12); CIRC(960, 1080, 50, '#3a332c'); glow(960, 1100, 210);
  floorY(1400, '#8a6844');
  vig();
}
function bgWH() {
  wall('#1c2334', '#2c3650');
  stars(10);
  const bx = 540;
  RRECT(bx - 360, 700, 720, 420, 4, '#e8e4da');
  g.beginPath(); g.moveTo(bx - 380, 700); g.lineTo(bx, 560); g.lineTo(bx + 380, 700); g.closePath();
  g.fillStyle = '#dcd8cc'; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
  for (let i = 0; i < 6; i++) {
    const cx = bx - 300 + i * 120;
    RRECT(cx - 26, 720, 52, 380, 4, '#f2eee2');
    LINE([[cx - 26, 720], [cx + 26, 720]], 6);
  }
  LINE([[bx, 480], [bx, 560]], 8);
  SHAPE([[bx, 480], [bx + 90, 496], [bx, 512]], '#a83232');
  floorY(1120, '#20263a');
  glow(540, 900, 500, '255,240,200', .15);
  vig();
}
function bgSG() {
  wall('#0c1728', '#1a2d49');
  stars(12);
  city(0, 900, W, 260, 14, '#142436');
  const bx = 540;
  for (const dx of [-160, 0, 160]) {
    RRECT(bx + dx - 60, 560, 120, 500, 4, '#1b3049');
    for (let r = 0; r < 6; r++) for (const c of [-1, 1]) if ((r + dx / 160 + c + 4) % 3 === 0) {
      g.fillStyle = 'rgba(255,220,140,.48)'; g.fillRect(bx + dx + c * 24 - 9, 600 + r * 70, 18, 28);
    }
  }
  g.beginPath(); g.ellipse(bx, 560, 260, 60, 0, Math.PI, 0); g.fillStyle = '#24405f'; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
  RRECT(bx - 210, 518, 420, 54, 8, '#24405f');
  glow(bx, 540, 220, '140,200,255', .34);
  floorY(1060, '#102033');
  g.fillStyle = 'rgba(105,155,205,.13)'; g.fillRect(0, 1060, W, 370);
  for (let y = 1110; y < 1410; y += 54) {
    g.strokeStyle = 'rgba(140,190,230,.13)'; g.lineWidth = 4; g.beginPath();
    for (let x = -40; x < W + 40; x += 90) g.lineTo(x + 45, y + Math.sin(x * .03 + (g.__t || 0)) * 7);
    g.stroke();
  }
  routeCurve([[70, 1165], [260, 1260], [500, 1205], [735, 1315], [990, 1185]], 'rgba(232,184,76,.72)', 6);
  cargoShip(720 + Math.sin((g.__t || 0) * .35) * 28, 1235, .72);
  g.beginPath(); g.ellipse(540, 1400, 500, 60, 0, 0, 7); g.fillStyle = 'rgba(140,180,220,.10)'; g.fill();
  vig();
}
function bgFlat() { wall('#17141c', '#0c0a0f'); vig(); }
/* ---------- end backgrounds ---------- */

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
function emailCard(x, y, w, p = 1) {
  const e = ease(p); if (!e) return;
  const h = w * 1.05;
  g.save(); g.translate(x, y); g.scale(e, e); g.globalAlpha = e;
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 26; g.shadowOffsetY = 12;
  RRECT(-w / 2, -h / 2, w, h, 14, '#faf6ee'); g.shadowColor = 'transparent';
  RRECT(-w / 2, -h / 2, w, 90, 14, '#2c3038');
  TXT('ถึง: พนักงานทั้งบริษัท', 0, -h / 2 + 58, 34, '#e8dede', 'center', 600);
  g.strokeStyle = '#a9aeb6'; g.lineWidth = 5;
  for (let i = 0; i < 7; i++) { const yy = -h / 2 + 140 + i * 46; g.beginPath(); g.moveTo(-w / 2 + 34, yy); g.lineTo(w / 2 - 34, yy); g.stroke(); }
  g.save(); g.rotate(-.12);
  g.lineWidth = 7; g.strokeStyle = '#a83232'; g.strokeRect(-170, -40, 340, 92);
  TXT('เผยแพร่แล้ว', 0, 22, 40, '#a83232', 'center', 800);
  g.restore(); g.restore();
}
function quoteCard(lines, p, y = 900) {
  const e = ease(p); if (!e) return;
  g.save(); g.globalAlpha = e;
  RRECT(90, y - 60, 900, 120 + lines.length * 96, 26, 'rgba(16,12,14,.9)');
  g.lineWidth = 8; g.strokeStyle = '#a83232'; g.stroke();
  lines.forEach((s, i) => TXT(s, W / 2, y + 40 + i * 92, 54, i ? '#e8dede' : '#e05252', 'center', 800));
  g.restore();
}
function pop(txt, x, y, color, p, size = 110) {
  const e = ease(p); if (!e) return;
  const s = e * (1.18 - .18 * e);
  g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = e;
  g.font = `900 ${size}px ${FONT}`; g.textAlign = 'center';
  g.lineWidth = 14; g.strokeStyle = OL; g.strokeText(txt, 0, 0);
  g.fillStyle = color; g.fillText(txt, 0, 0);
  g.restore();
}
function chip(txt, x, y, color, size = 30) {
  g.font = `700 ${size}px ${FONT}`; const w = g.measureText(txt).width + 56;
  RRECT(x - w / 2, y - 30, w, 60, 30, 'rgba(20,18,16,.88)', 6);
  TXT(txt, x, y + 12, size, color);
}
function doorLight(x, w, h) {
  const gr = g.createLinearGradient(x - w, 0, x + w, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, 'rgba(255,238,190,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(x - w, 0, w * 2, h);
}
function chartCard(x, y, w, h, pts, col, label, labCol = '#e8dede') {
  RRECT(x - w / 2, y - h / 2, w, h, 14, 'rgba(14,16,22,.92)');
  g.lineWidth = 7; g.strokeStyle = OL; g.stroke();
  g.strokeStyle = col; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(x - w / 2 + 40 + px * (w - 80), y - h / 2 + 40 + py * (h - 100)) : g.moveTo(x - w / 2 + 40 + px * (w - 80), y - h / 2 + 40 + py * (h - 100))); g.stroke();
  TXT(label, x, y + h / 2 - 30, 34, labCol, 'center', 800);
}
function gpuChip(x, y, s, col = '#76b900') {
  g.save(); g.translate(x, y); g.scale(s, s);
  SHAPE([[-80, -80], [80, -80], [80, 80], [-80, 80]], '#1c2434');
  RRECT(-46, -46, 92, 92, 8, '#0f1420');
  for (const sd of [-1, 1]) for (let i = -3; i <= 3; i++) {
    LINE([[sd * 80, i * 20], [sd * 116, i * 20]], 8);
    LINE([[i * 20, sd * 80], [i * 20, sd * 116]], 8);
  }
  TXT('GPU', 0, 18, 44, col, 'center', 800);
  g.restore();
}
function photoCard(x, y, w, rot, draw, p = 1) {
  const e = ease(p); if (!e) return;
  const h = w * 1.28;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(e, e); g.globalAlpha = e;
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 18; g.shadowOffsetY = 8;
  RRECT(-w / 2, -h / 2, w, h, 8, '#f4f1ea'); g.shadowColor = 'transparent';
  const iw = w - 32, ih = h - w * .34;
  g.save(); g.beginPath(); g.roundRect(-iw / 2, -ih / 2, iw, ih, 6); g.clip();
  draw(iw, ih);
  g.restore();
  g.beginPath(); g.roundRect(-iw / 2, -ih / 2, iw, ih, 6); g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
  g.restore();
}
function footnote() {
  TXT('อ้างอิงรายงานข่าวจริง · บางส่วนยังไม่ยืนยัน · ภาพและตัวละครจำลอง', W / 2, 268, 22, 'rgba(255,255,255,.42)', 'center', 500);
}
const SUB_CACHE = new Map();
function subUnits(txt) {
  if (SEG_WORD) {
    try { return Array.from(SEG_WORD.segment(txt), s => s.segment).filter(Boolean); } catch (e) { }
  }
  return txt.split(/(\s+)/).filter(Boolean);
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
const ms = o => o.em * 1.6;
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

/* ---------- scenes ---------- */
function scColdOpen(o) {
  cam(o, { z0: 1.05, z1: 1.14, x0: -10, x1: 12, cy: 1060, punch: .018, driftX: 5, driftY: 3 }, () => {
    bgHQ();
    tint('4,4,10', .14);
    rain(.08, 24);
    g.globalAlpha = .84;
    person('jensen', { x: 548, y: 1660, scale: .95, t: o.t, back: true });
    g.globalAlpha = 1;
    rim(548, 1660, .95, 1, 'rgba(118,185,0,.42)');
    rain(.06, 18);
  });
  pop('11 วัน', 540, 430, '#e05252', Math.min(1, o.p * 2.4), 170);
  TXT('ชายที่ทรงพลังที่สุดในวงการชิป ออกจากตำแหน่ง', 540, 510, 44, '#e8dede', 'center', 600);
  if (o.i >= 3) {
    chip('ตามรายงานข่าว · ภาพจำลองเพื่อการเล่า', 540, 610, '#e8b84c', 30);
    paperSheet(850, 690, 120, 154, .12, Math.min(1, o.lp * 2), 'LEAK');
  }
}
function scHook(o) {
  cam(o, { z0: 1.045, z1: 1.11, x0: 8, x1: -8, cy: 980, punch: .026, driftX: 5 }, () => {
    bgFlat();
    tint('20,60,20', .06);
    circuitField(.16);
    glow(540, 900, 650, '118,185,0', .16);
    g.save(); g.globalAlpha = .07; g.rotate(-Math.PI / 2); TXT('JENSEN HUANG', -850, 92, 92, '#e8dede', 'center', 900); g.restore();
    person('jensen', { x: 540, y: 1560, scale: 1.28, t: o.t, look: 1, blink: (o.t % 3.4) < .12, mouth: mouthFor('J', o), mood: 'smile' });
    rim(540, 1560, 1.28, 1, 'rgba(118,185,0,.24)');
    if (o.i >= 6) chip('เจนเซ่น หวง · ผู้ร่วมก่อตั้ง NVIDIA', 540, 590, '#76b900', 34);
    if (o.i >= 7) {
      gpuChip(238, 795, .62);
      routeCurve([[332, 795], [430, 830], [462, 902]], 'rgba(118,185,0,.55)', 5);
    }
  });
}
function scOrigin(o) {
  cam(o, { z0: 1.045, z1: 1.1, x0: -12, x1: 14, cy: 1010, punch: .022, driftX: 5 }, () => {
    bgDinerV2();
    TXT('1993', 540, 440, 120, '#e8b84c', 'center', 900);
    g.strokeStyle = '#a83232'; g.lineWidth = 8; g.beginPath(); g.moveTo(330, 470); g.lineTo(750, 470); g.stroke();
    person('youngJensen', { x: 335, y: 1548, scale: 1.0, t: o.t, look: 1, blink: (o.t % 3.3) < .12, mood: 'smile' });
    g.globalAlpha = .48;
    person('shadow', { x: 735, y: 1548, scale: .96, t: o.t });
    person('shadow', { x: 910, y: 1552, scale: .88, t: o.t + .8 });
    g.globalAlpha = 1;
    g.beginPath(); g.ellipse(560, 1415, 430, 82, 0, 0, 7); g.fillStyle = '#7a4e2a'; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
    g.beginPath(); g.ellipse(560, 1398, 405, 52, 0, 0, 7); g.fillStyle = '#9a6334'; g.fill();
    for (const dx of [-120, 92]) {
      CIRC(560 + dx, 1390, 40, '#f0e6d4'); CIRC(560 + dx, 1388, 30, '#4a2c1a', 5);
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(560 + dx, 1362); g.quadraticCurveTo(570 + dx, 1338, 560 + dx, 1314); g.stroke();
    }
    paperSheet(560, 1390, 170, 112, -.07, 1);
    routeCurve([[515, 1378], [548, 1364], [580, 1388], [612, 1368]], '#76b900', 4);
    if (o.i >= 12) gpuChip(842, 1300, .48);
    if (o.i >= 13) chip('เสื้อหนังสีดำ = เครื่องแบบของยุค AI', 540, 700, '#e8b84c', 32);
  });
}
function bgDinerV2() {
  wall('#422e20', '#281a12');
  win(120, 380, 840, 420, '#0d1626', 3);
  city(140, 640, 800, 150, 10, '#16232f');
  for (const [x, y] of [[280, 620], [500, 580], [720, 640], [880, 540]]) glow(x, y, 9, '255,170,90', .8);
  RRECT(340, 500, 400, 84, 42, '#3a1e16');
  TXT('DINER', 540, 557, 56, '#e8b84c', 'center', 800);
  for (const x of [220, 860]) {
    LINE([[x, 0], [x, 260]], 7);
    SHAPE([[x - 55, 260], [x + 55, 260], [x + 38, 320], [x - 38, 320]], '#1e1a16');
    glow(x, 340, 160);
  }
  floorY(1460, '#3a2418');
  vig();
}
function scLetter(o) {
  cam(o, { z0: 1.045, z1: 1.105, x0: 16, x1: -14, cy: 930, punch: .026, driftX: 5 }, () => {
    bgDesk();
    tint('10,8,12', .17);
    wallClock(168, 430, 56, o.t);
    paperSheet(170, 940, 170, 220, -.1, 1, 'สำเนา');
    paperSheet(650, 1000, 150, 190, .13, Math.min(1, o.p * 1.8));
    person('jensen', { x: 830, y: 1560, scale: 1.1, t: o.t, look: -1, blink: (o.t % 3.4) < .12, mood: 'tense', mouth: mouthFor('J', o) });
    rim(830, 1560, 1.1, -1);
    emailCard(360, 700, 480, Math.min(1, o.p * 2));
    const pulse = .45 + .25 * Math.sin(o.t * 5);
    CIRC(548, 512, 18, `rgba(224,82,82,${pulse})`, 4);
    TXT('1', 548, 523, 24, '#f4f1ea', 'center', 900);
  });
  if (o.i >= 15) quoteCard(['"ผมนอกใจภรรยา"', '"ผมขอโทษอย่างสุดซึ้ง"'], (o.i === 15 ? o.lp : 1) * 1.5, 1150);
  else TXT('8 พฤศจิกายน', 540, 380, 60, '#f4f1ea', 'center', 800);
}
function scTurn(o) {
  const e = ease(o.p);
  cam(o, { z0: 1.05, z1: 1.13, x0: -18, x1: 18, cy: 1050, punch: .025, driftX: 7 }, () => {
    bgAlley();
    tint('8,6,14', .2);
    rain(.13, 30);
    g.globalAlpha = .92;
    person('alice', { x: 800 - e * 270, y: 1620, scale: 1.06 + e * .14, t: o.t, back: true, walk: o.p < .82 });
    g.globalAlpha = 1;
    glow(520, 1450, 320, '255,120,80', .12);
    rain(.07, 18);
  });
  if (o.i >= 20) pop('อลิซ หวง', 540, 500, '#e05252', o.lp * 1.8, 120);
  else TXT('ผู้หญิงที่สื่อพูดถึง…', 540, 500, 52, '#e8dede', 'center', 700);
}
function scAlice(o) {
  cam(o, { z0: 1.04, z1: 1.095, x0: 12, x1: -12, cy: 970, punch: .023, driftX: 5 }, () => {
    bgOffice();
    tint('20,14,10', .08);
    g.globalAlpha = .78;
    serverRack(72, 760, 145, 390, '#e8b84c');
    serverRack(875, 790, 135, 340, '#e8b84c');
    g.globalAlpha = 1;
    routeCurve([[220, 880], [350, 840], [440, 910]], 'rgba(232,184,76,.38)', 4);
    person('alice', { x: 520, y: 1560, scale: 1.22, t: o.t, look: 1, blink: (o.t % 3.1) < .12, pose: o.i >= 24 ? 'fold' : 'idle', mood: o.i >= 24 ? 'tense' : 'neutral' });
    nameCard(820, 730, 330, 'alice', 'อลิซ หวง', 'อดีต CEO Megaspeed', Math.min(1, o.p * 2));
    if (o.i >= 22) gpuChip(230, 1080, .42);
    if (o.i >= 23) chip('แถลง: ลงจาก CEO ปลาย ส.ค. ปีก่อน', 540, 660, '#e8b84c', 30);
    if (o.i >= 24) docBadge('สอบสวน', 540, 1130, '#e05252', o.i === 24 ? o.lp * 1.8 : 1);
  });
}
function scChips(o) {
  cam(o, { z0: 1.04, z1: 1.095, x0: -10, x1: 10, cy: 900, punch: .022, driftX: 5 }, () => {
    bgFlat();
    tint('10,20,30', .18);
    circuitField(.2, '96,160,190');
    glow(540, 470, 480, '118,185,0', .12);
    TXT('เส้นทางชิป', 540, 380, 64, '#e8dede', 'center', 900);
    gpuChip(540, 490, 1.0);
    g.globalAlpha = .55;
    serverRack(62, 745, 130, 390);
    serverRack(888, 720, 130, 410);
    g.globalAlpha = 1;
    const nodes = [
      ['ชิป NVIDIA', 270, 700, '#76b900', '1'],
      ['สิงคโปร์', 740, 835, '#e8b84c', '2'],
      ['มาเลเซีย', 300, 1010, '#e8b84c', '3'],
      ['จีน?', 760, 1160, '#e05252', '?'],
    ];
    routeCurve(nodes.map(n => [n[1], n[2]]), 'rgba(232,184,76,.78)', 7);
    nodes.forEach(([label, x, y, col, mark]) => {
      CIRC(x, y, 54, '#1a2434'); CIRC(x, y, 54, null, 7);
      TXT(mark, x, y + 14, 38, col, 'center', 900);
      TXT(label, x, y + 108, 38, col, 'center', 800);
    });
    cargoShip(655, 1120, .52);
    g.fillStyle = 'rgba(168,50,50,.16)'; g.fillRect(0, 1268, W, 142);
    g.strokeStyle = '#a83232'; g.lineWidth = 8; g.setLineDash([18, 14]);
    g.beginPath(); g.moveTo(100, 1268); g.lineTo(980, 1268); g.stroke(); g.setLineDash([]);
    TXT('เขตห้ามส่งออกของสหรัฐ', 540, 1348, 40, '#e05252', 'center', 800);
    if (o.i >= 29) chip('Megaspeed สอบสวนภายในเองด้วย', 540, 600, '#e8b84c', 30);
  });
}
function scTaipei(o) {
  cam(o, { z0: 1.045, z1: 1.1, x0: 10, x1: -12, cy: 940, punch: .024, driftX: 5 }, () => {
    bgExpo();
    for (let x = 80; x < W; x += 120) {
      CIRC(x, 1360 + (x % 3) * 12, 34, '#080a10', 5);
      RRECT(x - 34, 1390, 68, 96, 24, '#080a10', 5);
    }
    person('jensen', { x: 390, y: 1420, scale: 1.0, t: o.t, look: 1, blink: (o.t % 3.6) < .12, mouth: mouthFor('J', o), mood: 'smile' });
    person('alice', { x: 640, y: 1420, scale: .98, t: o.t, look: -1, blink: (o.t % 2.9) < .12, mood: 'neutral' });
    for (const [fx, fy, ph] of [[180, 900, 0], [880, 820, 2.1], [300, 1180, 4.2]]) {
      const a = Math.max(0, Math.sin(o.t * 5 + ph)) ** 6;
      if (a > .01) { g.globalAlpha = a * .9; CIRC(fx, fy, 32, '#fff', 0); g.globalAlpha = 1; }
    }
    if (o.i >= 32) photoCard(890, 880, 260, .04, (w, h) => {
      const wall = g.createLinearGradient(0, -h / 2, 0, h / 2); wall.addColorStop(0, '#3d2b20'); wall.addColorStop(1, '#22170f');
      g.fillStyle = wall; g.fillRect(-w / 2, -h / 2, w, h);
      glow(-w * .3, -h * .4, 90, '255,196,120', .4); glow(w * .3, -h * .4, 90, '255,196,120', .4);
      person('jensen', { x: -w * .22, y: 80, scale: .3, sit: true, look: 1, mood: 'smile', t: o.t });
      person('alice', { x: w * .22, y: 80, scale: .3, sit: true, look: -1, mood: 'neutral', t: o.t });
      g.beginPath(); g.ellipse(0, 26, w * .5, 20, 0, 0, 7); g.fillStyle = '#7a4e2a'; g.fill(); g.lineWidth = 4; g.strokeStyle = OL; g.stroke();
      TXT('ฟุตเทจร้านอาหาร · ไทเป', 0, h / 2 - 40, 19, '#f0e6d4', 'center', 700);
      TXT('ภาพจำลอง ไม่ใช่ฟุตเทจจริง', 0, h / 2 - 16, 14, '#e8b84c', 'center', 600);
    }, o.i === 32 ? o.lp * 1.6 : 1);
    if (o.i >= 35) chip('เรื่องเริ่มเปลี่ยนสี →', 540, 700, '#e05252', 34);
  });
}
function scMSS(o) {
  cam(o, { z0: 1.045, z1: 1.115, x0: -12, x1: 14, cy: 1010, punch: .028, driftX: 6 }, () => {
    bgAlley();
    tint('20,8,8', .13);
    rain(.1, 28);
    paperSheet(150, 610, 180, 240, -.09, Math.min(1, o.p * 2), 'MSS');
    if (o.i >= 37) {
      routeCurve([[170, 820], [360, 760], [560, 820], [780, 745], [910, 790]], 'rgba(224,82,82,.55)', 5);
      for (const [x, label] of [[250, 'ผลิ'], [540, 'ร่วง'], [830, 'ปีนี้']]) {
        CIRC(x, 795, 17, '#a83232', 4); TXT(label, x, 850, 24, '#e8dede', 'center', 700);
      }
    }
    person('alice', { x: 400, y: 1500, scale: 1.08, t: o.t, look: 1, blink: (o.t % 3.2) < .12, pose: 'idle', mood: o.i >= 39 ? 'worry' : 'neutral' });
    person('shadow', { x: 740, y: 1510, scale: 1.12, t: o.t });
    CIRC(714, 966, 7, '#c23a3a', 0); CIRC(762, 966, 7, '#c23a3a', 0);
    if (o.i >= 38) routeCurve([[470, 1000], [560, 930], [655, 1000]], 'rgba(224,82,82,.42)', 4);
    pop('?', 740, 700, '#e05252', o.i >= 36 ? .5 + .3 * Math.sin(o.t * 2) : 0, 110);
    if (o.i >= 39) docBadge('ยังไม่พิสูจน์', 540, 520, '#e8b84c', o.i === 39 ? o.lp * 1.7 : 1);
    if (o.i >= 41) paperSheet(900, 620, 160, 210, .1, 1, 'ปฏิเสธ');
    chip('NYT: ติดต่อ MSS นานกว่า 1 ปี · ยังไม่พิสูจน์', 540, 440, '#e8b84c', 30);
  });
}
function scNoWarn(o) {
  cam(o, { z0: 1.045, z1: 1.105, x0: 12, x1: -12, cy: 980, punch: .027, driftX: 5 }, () => {
    bgWH();
    tint('8,10,18', .08);
    paperSheet(835, 520, 190, 250, .08, Math.min(1, o.p * 1.8), 'เตือน');
    paperSheet(920, 610, 145, 190, -.12, Math.min(1, o.p * 1.5), 'เตือน');
    if (o.i >= 45) {
      for (let r = 0; r < 3; r++) {
        g.save(); g.globalAlpha = .22 - r * .05 + Math.sin(o.t * 2 + r) * .04;
        g.beginPath(); g.arc(800, 1050, 120 + r * 54 + Math.sin(o.t * 2) * 8, 0, 7); g.lineWidth = 5; g.strokeStyle = '#e05252'; g.stroke(); g.restore();
      }
    }
    person('trump', { x: 320, y: 1480, scale: 1.1, t: o.t, look: 1, blink: (o.t % 4.1) < .12, pose: 'fold', mood: o.i >= 49 ? 'tense' : 'resolute' });
    g.globalAlpha = .6;
    person('jensen', { x: 800, y: 1520, scale: .9, t: o.t, back: true });
    g.globalAlpha = 1;
    if (o.i >= 45) pop('ไม่มีการบรีฟเตือน', 540, 470, '#e05252', o.i === 45 ? o.lp * 1.8 : 1, 92);
    if (o.i >= 47) {
      docBadge('เตือน 2 ครั้ง', 250, 650, '#e8b84c', o.i === 47 ? o.lp * 1.7 : 1);
      pop('!', 180, 560, '#e05252', .8, 74); pop('!', 330, 560, '#e05252', .8, 74);
    }
    if (o.i >= 49) chip('ทรัมป์ปฏิเสธ', 540, 650, '#8a8f98', 30);
  });
}
function scSingapore(o) {
  cam(o, { z0: 1.045, z1: 1.105, x0: -10, x1: 12, cy: 990, punch: .024, driftX: 5 }, () => {
    bgSG();
    person('alice', { x: 540, y: 1480, scale: 1.1, t: o.t, look: 1, blink: (o.t % 3.1) < .12, mood: o.i >= 53 ? 'tense' : 'worry' });
    rim(540, 1480, 1.1, 1, 'rgba(140,200,255,.34)');
    const items = [
      [51, 'สอบสวนตั้งแต่ 2025', '#e8dede', 292, 420],
      [52, 'หลักฐานไม่พอฟ้อง', '#7ed69a', 788, 450],
      [53, 'ตักเตือน + แบนเข้าประเทศ', '#e05252', 292, 550],
      [55, '"ไม่ได้สอบเรื่องจารกรรม"', '#e8b84c', 788, 650],
    ];
    items.forEach(([i, txt, col, x, y]) => { if (o.i >= i) docBadge(txt, x, y, col, o.i === i ? o.lp * 1.7 : 1); });
    if (o.i >= 56) docBadge('ยังไม่จบ', 540, 770, '#e05252', o.i === 56 ? o.lp * 1.8 : 1);
  });
}
function scScore(o) {
  cam(o, { z0: 1.045, z1: 1.09, x0: -5, x1: 6, cy: 880, punch: .038, punchDur: .48, driftX: 3 }, () => {
    bgFlat();
    circuitField(.08, '150,160,170');
    TXT('SCOREBOARD', 540, 340, 30, '#8a8f98', 'center', 800);
    TXT('ตอนนี้รู้อะไรบ้าง', 540, 400, 64, '#e8dede', 'center', 900);
    g.setLineDash([10, 12]); LINE([[540, 430], [540, 1370]], 5); g.setLineDash([]);

    RRECT(105, 430, 870, 310, 24, 'rgba(14,24,17,.92)');
    g.lineWidth = 9; g.strokeStyle = '#3f9e5a'; g.stroke();
    g.save(); g.globalAlpha = .12; TXT('✓', 285, 650, 210, '#7ed69a', 'center', 900); g.restore();
    CIRC(275, 585, 72, '#17351f'); TXT('✓', 275, 620, 88, '#7ed69a', 'center', 900);
    TXT('สัมพันธ์', 620, 570, 66, '#7ed69a', 'center', 900);
    TXT('เขายอมรับเอง', 620, 645, 44, '#f0e9dd', 'center', 700);

    CIRC(540, 805, 74, '#20242c'); CIRC(540, 805, 74, null, 8);
    TXT('VS', 540, 826, 52, '#e8dede', 'center', 900);

    const e2 = o.i >= 58 ? ease(o.lp * 1.6) : .38;
    g.globalAlpha = .48 + e2 * .52;
    RRECT(105, 870, 870, 310, 24, 'rgba(28,14,17,.92)');
    g.lineWidth = 9; g.strokeStyle = '#a83232'; g.stroke();
    g.save(); g.globalAlpha = .12; TXT('?', 285, 1095, 210, '#e05252', 'center', 900); g.restore();
    CIRC(275, 1025, 72, '#3a171b'); TXT('?', 275, 1058, 88, '#e05252', 'center', 900);
    TXT('สายลับ', 620, 1010, 66, '#e05252', 'center', 900);
    TXT('ยังไม่มีใครพิสูจน์ได้', 620, 1085, 44, '#f0e9dd', 'center', 700);
    g.globalAlpha = 1;

    chip('ยืนยันแล้ว  vs  ยังเป็นคำถาม', 540, 960, '#e8b84c', 28);
  });
}
function scResign(o) {
  const walk = ease(o.p), px = 285 + walk * 455;
  cam(o, { z0: 1.045, z1: 1.105, x0: 16, x1: -16, cy: 980, punch: .026, driftX: 5 }, () => {
    bgOffice();
    tint('8,8,14', .18);
    wallClock(158, 700, 52, o.t * 1.2);
    doorLight(880, 110, H);
    RRECT(820, 470, 180, 930, 8, 'rgba(28,24,21,.9)');
    g.save(); g.lineWidth = 11; g.strokeStyle = '#5a4326'; g.beginPath(); g.roundRect(820, 470, 180, 930, 8); g.stroke();
    g.globalAlpha = .55; LINE([[838, 520], [838, 1375]], 5); g.globalAlpha = 1;
    RRECT(850, 430, 120, 48, 8, '#2a1010', 5); TXT('EXIT', 910, 466, 30, '#e05252', 'center', 900);
    g.restore();
    if (o.p < .85) for (let k = 0; k < 3; k++) {
      g.save(); g.globalAlpha = .16 - k * .04; LINE([[px - 150 - k * 34, 1110 + k * 40], [px - 70 - k * 34, 1110 + k * 40]], 5); g.restore();
    }
    person('jensen', { x: px, y: 1520, scale: 1.05, t: o.t, back: true, walk: o.p < .85, mood: 'worry' });
    for (let k = 0; k < 3; k++) paperSheet(210 + k * 190, 960 + (k * 57) % 120, 92, 118, (k - 1) * .16, Math.max(0, Math.min(1, o.p * 3 - k * .35)));
    if (o.i < 61) newsCard(300, 650, 360, -.07, 'CEO ลาออก', Math.min(1, o.p * 2.5));
    if (o.i >= 61) chartCard(540, 620, 720, 360, [[0, .15], [.3, .9], [.55, .95], [1, .5]], '#d34a3a', '−14% ระหว่างวัน → ปิด −4.3%', '#e05252');
    if (o.i >= 63) chip('52-week low · AMD/Broadcom พุ่ง', 540, 900, '#e8b84c', 30);
    if (o.i >= 65) nameCard(220, 1160, 300, 'kress', 'Colette Kress', 'รักษาการ CEO', Math.min(1, (o.i === 65 ? o.lp : 1) * 1.8));
    if (o.i >= 66) chip('คณะกรรมการอิสระสอบสวน', 540, 365, '#8a8f98', 30);
  });
}
function scGone(o) {
  cam(o, { z0: 1.04, z1: 1.085, x0: -4, x1: 5, cy: 900, punch: .022, driftX: 3, driftY: 3 }, () => {
    wall('#14121b', '#09090e');
    circuitField(.07, '130,140,165');
    const sp = g.createRadialGradient(540, 1080, 70, 540, 1080, 650);
    sp.addColorStop(0, 'rgba(220,225,240,.24)'); sp.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sp; g.fillRect(0, 0, W, H);
    TXT('ช่วงนอกตำแหน่ง', 540, 405, 34, '#8a8f98', 'center', 700);
    pop('11 วัน', 540, 545, '#a7adb8', .45 + o.p * .55, 160);
    wallClock(880, 420, 72, o.t * 1.5);
    paperSheet(165, 420, 132, 170, -.08, 1, 'พ.ย.');
    const progress = o.p * 11.4;
    for (let d = 0; d < 11; d++) {
      const active = clamp01(progress - d), x = 145 + (d % 4) * 205, y = 555 + Math.floor(d / 4) * 145;
      g.globalAlpha = .68 + active * .32;
      RRECT(x, y, 170, 105, 12, active > .05 ? '#2a3040' : '#1d202b', 5);
      g.beginPath(); g.roundRect(x + 5, y + 5, 160, 95, 9); g.lineWidth = 4;
      g.strokeStyle = d === 10 && active > .4 ? '#e05252' : active > .35 ? '#8a93a8' : '#4d5362'; g.stroke();
      TXT(String(d + 1), x + 85, y + 70, 48, active > .35 ? '#f0e9dd' : '#858b99', 'center', 800);
      if (active > .7) TXT('×', x + 85, y + 92, 30, d === 10 ? '#e05252' : '#8a8f98', 'center', 900);
    }
    g.globalAlpha = 1;
    if (o.i <= 69) {
      g.save(); g.globalAlpha = .34; g.setLineDash([13, 12]); g.lineWidth = 7; g.strokeStyle = '#8a93a8';
      g.beginPath(); g.arc(540, 1055, 82, 0, 7); g.stroke();
      g.beginPath(); g.roundRect(438, 1135, 204, 210, 78); g.stroke();
      g.setLineDash([]); TXT('?', 540, 1078, 82, '#a7adb8', 'center', 900);

      g.restore();
    }
    if (o.i >= 70 && o.i < 71) {
      docBadge('โซเชียลเดา', 300, 940, '#8a8f98', o.lp * 1.5);
      docBadge('ไม่มีคำตอบ', 780, 940, '#e05252', o.lp * 1.5);
    }
    g.save(); g.globalAlpha = .28;
    RRECT(122, 1120, 130, 160, 24, '#151923', 6);
    LINE([[187, 1280], [150, 1370]], 10); LINE([[187, 1280], [224, 1370]], 10);
    g.restore();
    if (o.i >= 71) chartCard(540, 940, 720, 300, [[0, .1], [.5, .55], [1, .85]], '#d34a3a', '173.73 → 125.53', '#e05252');
    if (o.i >= 73) chip('บอร์ด: "ไม่ได้พิจารณารับเขากลับ"', 540, 1230, '#e8dede', 32);
  });
}
function scReturn(o) {
  cam(o, { z0: 1.045, z1: 1.105, x0: -10, x1: 12, cy: 990, punch: .026, driftX: 5 }, () => {
    bgBoard();
    tint('8,10,16', .13);
    glow(540, 1020, 520, '118,185,0', .11);
    RRECT(80, 1380, 920, 130, 16, '#5a4326');
    for (let i = 0; i < 7; i++) CIRC(180 + i * 120, 1418, 18, i < 7 ? '#3f9e5a' : '#2a3038', 4);
    person('jensen', { x: 540, y: 1620, scale: 1.15, t: o.t, look: 1, blink: (o.t % 3.4) < .12, mood: 'resolute', mouth: mouthFor('J', o) });
    if (o.i >= 78 && o.i < 84) pop('เอกฉันท์', 540, 560, '#7ed69a', o.i === 78 ? o.lp * 1.8 : 1, 130);
    if (o.i >= 80 && o.i < 84) paperSheet(835, 610, 170, 220, .08, 1, 'WH');
    if (o.i >= 82 && o.i < 84) chartCard(540, 800, 720, 340, [[0, .8], [.4, .5], [.7, .3], [1, .05]], '#3f9e5a', '+30% ตั้งแต่เปิดตลาด', '#7ed69a');
    if (o.i >= 79) person('trump', { x: 870, y: 1620, scale: .88, t: o.t, flip: true, look: -1, blink: (o.t % 4.1) < .12, mood: 'resolute', mouth: mouthFor('T', o) });
    if (o.i >= 84) {
      const qe = ease(o.i === 84 ? o.lp * 1.5 : 1);
      g.save(); g.globalAlpha = qe;
      SHAPE([[742, 824], [812, 824], [872, 930]], 'rgba(16,12,14,.9)');
      RRECT(140, 640, 680, 210, 26, 'rgba(16,12,14,.92)');
      g.lineWidth = 8; g.strokeStyle = '#a83232'; g.stroke();
      TXT('"สมบัติของชาติ"', 480, 730, 52, '#e05252', 'center', 900);
      TXT('— ทรัมป์ พูดถึงเจนเซ่น', 480, 800, 36, '#e8dede', 'center', 700);
      g.restore();
    }
    if (o.i >= 85) chip('คณะกรรมการอิสระยังสอบต่อ', 540, 435, '#e8b84c', 30);
    if (o.i >= 87) docBadge('1 ธ.ค. · คองเกรส', 540, 590, '#8aa4d8', o.i === 87 ? o.lp * 1.7 : 1);
  });
}
function scWhy(o) {
  cam(o, { z0: 1.045, z1: 1.12, x0: 6, x1: -6, cy: 980, punch: .025, driftX: 4 }, () => {
    bgFlat();
    circuitField(.18);
    glow(540, 900, 670, '118,185,0', .17);
    TXT('ทำไมต้องเป็นเขา', 540, 400, 62, '#e8dede', 'center', 900);
    g.save(); g.globalAlpha = .11; TXT('NVIDIA', 540, 490, 150, '#76b900', 'center', 900); g.restore();
    gpuChip(180, 620, .42); gpuChip(900, 620, .42);
    person('jensen', { x: 540, y: 1540, scale: 1.3, t: o.t, look: 1, blink: (o.t % 3.4) < .12, mouth: mouthFor('J', o), mood: 'resolute' });
    rim(540, 1540, 1.3, 1, 'rgba(118,185,0,.25)');
    if (o.i === 89) chip('นักวิเคราะห์: "หน้าตาของกระแส AI"', 540, 690, '#e8b84c', 30);
    if (o.i >= 90) {
      g.globalAlpha = .94;
      TXT('เขา', 400, 690, 96, '#e8dede', 'center', 900);
      TXT('=', 540, 690, 96, '#76b900', 'center', 900);
      TXT('NVIDIA', 720, 690, 88, '#76b900', 'center', 900);
      g.globalAlpha = 1;
    }
    if (o.i >= 91) chip('"ดีที่สุดสำหรับผู้ถือหุ้น พนักงาน พาร์ตเนอร์"', 540, 825, '#e8dede', 30);
  });
}
function scLori(o) {
  cam(o, { z0: 1.04, z1: 1.095, x0: -8, x1: 8, cy: 990, punch: .021, driftX: 4 }, () => {
    bgHome();
    tint('8,6,10', .14);
    g.save(); g.globalAlpha = .15; g.fillStyle = '#ffe9b8';
    g.beginPath(); g.moveTo(560, 200); g.lineTo(960, 200); g.lineTo(880, 1400); g.lineTo(400, 1400); g.fill(); g.restore();
    person('lori', { x: 560, y: 1520, scale: 1.15, t: o.t, look: -1, blink: (o.t % 4) < .12, pose: 'fold', mood: 'hurt' });
    if (o.i >= 92) {
      photoCard(250, 620, 340, -.06, (w, h) => {
        g.fillStyle = '#c9d4dc'; g.fillRect(-w / 2, -h / 2, w, h);
        TXT('OREGON STATE', 0, -96, 36, '#2a3038', 'center', 800);
        TXT('ภาพจำลอง', 0, -62, 20, '#5a5148', 'center', 600);
        g.beginPath(); g.moveTo(-110, 34); g.lineTo(0, 0); g.lineTo(110, 34); g.closePath(); g.fillStyle = '#8a6f5a'; g.fill(); g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
        for (const cx of [-88, -44, 0, 44, 88]) RRECT(cx - 8, 34, 16, 88, 3, '#f4f1ea', 4);
        RRECT(-112, 122, 224, 12, 3, '#8a6f5a', 4); RRECT(-124, 134, 248, 10, 3, '#b9a48c', 4);
      }, o.i === 92 ? o.lp * 1.6 : 1);
    }
    if (o.i >= 93) paperSheet(850, 650, 155, 200, .1, Math.min(1, o.lp * 2), 'การบ้าน');
    if (o.i >= 94) chip('แต่งงานปี 1985 · ก่อน NVIDIA', 760, 900, '#e8b84c', 28);
    if (o.i >= 96) {
      TXT('ความเงียบ ที่ดังที่สุด', 540, 390, 56, '#e8dede', 'center', 700);
      g.strokeStyle = '#8a8f98'; g.lineWidth = 5; g.beginPath();
      for (let x = 250; x <= 830; x += 20) {
        const amp = x > 510 && x < 570 ? 4 : 18 * Math.abs(Math.sin(x * .17));
        g.moveTo(x, 460 - amp); g.lineTo(x, 460 + amp);
      }
      g.stroke();
    }
  });
}
function scStakes(o) {
  cam(o, { z0: 1.045, z1: 1.105, x0: -7, x1: 7, cy: 900, punch: .028, driftX: 4 }, () => {
    bgFlat();
    g.save(); g.globalAlpha = .19;
    g.fillStyle = '#28457a'; g.beginPath(); g.moveTo(0, 0); g.lineTo(560, 0); g.lineTo(300, H); g.lineTo(0, H); g.fill();
    g.fillStyle = '#7a2020'; g.beginPath(); g.moveTo(560, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(300, H); g.fill();
    g.restore();
    circuitField(.1, '150,160,170');
    TXT('เดิมพันของเรื่องนี้', 540, 395, 58, '#e8dede', 'center', 900);
    g.save(); g.globalAlpha = .18;
    CIRC(540, 710, 290, null, 7);
    g.beginPath(); g.ellipse(540, 710, 290, 110, 0, 0, 7); g.lineWidth = 5; g.strokeStyle = '#9aa4b8'; g.stroke();
    g.beginPath(); g.ellipse(540, 710, 110, 290, 0, 0, 7); g.stroke();
    g.restore();
    gpuChip(540, 710, 1.2);
    routeCurve([[200, 710], [424, 710]], 'rgba(138,164,216,.7)', 7);
    routeCurve([[656, 710], [880, 710]], 'rgba(224,82,82,.7)', 7);
    TXT('US', 160, 730, 64, '#8aa4d8', 'center', 900);
    TXT('CN', 920, 730, 64, '#e05252', 'center', 900);
    docBadge('บอร์ด', 285, 990, '#8aa4d8', 1);
    docBadge('รัฐบาล', 795, 990, '#e05252', 1);
    if (o.i >= 99) pop('?', 540, 1060, '#e05252', o.i === 99 ? o.lp : 1, 120);
    if (o.i >= 100) TXT('ความมั่นคง หรือ เรื่องส่วนตัว?', 540, 950, 54, '#e8dede', 'center', 800);
    if (o.i >= 101) chip('ใหญ่เกินกว่าจะเป็นเรื่องส่วนตัว', 540, 1000, '#e8b84c', 30);
  });
}
function scCTA(o) {
  cam(o, { z0: 1.045, z1: 1.095, x0: 5, x1: -7, cy: 1000, punch: .018, driftX: 4 }, () => {
    bgHQ();
    tint('4,4,10', .32);
    rain(.06, 18);
    g.globalAlpha = .86;
    person('jensen', { x: 540, y: 1680, scale: .88, t: o.t, mood: 'resolute', look: 1, blink: (o.t % 3.8) < .12 });
    g.globalAlpha = 1;
    rim(540, 1680, .88, 1, 'rgba(118,185,0,.35)');
  });
  const e = ease(o.p * 1.3);
  if (e) {
    g.globalAlpha = e;
    TXT('หัวใจ', 400, 350, 88, '#e8dede', 'center', 900);
    TXT('หรือ', 540, 450, 56, '#8a8f98', 'center', 700);
    TXT('ความมั่นคง', 560, 590, 88, '#e05252', 'center', 900);
    g.globalAlpha = 1;
  }
  if (o.i >= 104) {
  }
  if (o.i >= 106) chip('อ้างอิงรายงานข่าวสาธารณะ · บางส่วนยังไม่ยืนยัน', 540, 700, '#8a8f98', 28);
}

const SC = [[5, scColdOpen], [9, scHook], [14, scOrigin], [19, scLetter], [21, scTurn], [25, scAlice], [30, scChips], [36, scTaipei], [44, scMSS], [50, scNoWarn], [57, scSingapore], [59, scScore], [69, scResign], [77, scGone], [88, scReturn], [92, scWhy], [97, scLori], [103, scStakes], [Infinity, scCTA]];
function shot(t) {
  let li = 0, lp = 0, line = null;
  for (let i = 0; i < L.length; i++) {
    if (t >= L[i].t0 && t < L[i].t0 + L[i].dur) { li = i; line = L[i]; lp = (t - L[i].t0) / L[i].dur; break; }
    if (t >= L[i].t0) { li = i; line = L[i]; lp = 1; }
  }
  const k = SC.findIndex(([till]) => li < till);
  const from = k === 0 ? 0 : SC[k - 1][0];
  const g0 = L[from].t0, g1 = SC[k][0] < L.length ? L[SC[k][0]].t0 : TALK.dur;
  const p = Math.min(1, Math.max(0, (t - g0) / (g1 - g0)));
  const em = line && line.env ? line.env[Math.min(line.env.length - 1, Math.floor(lp * line.env.length))] : 0;
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
