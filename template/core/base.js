/**
 * @file core/base.js — kernel primitives — canvas constants, shape helpers, segmenters, shared color/seeded-random utilities.
 * Part of the aiyu template runtime. Layer rules: core ← features ← story.
 */

(() => {

const W = 1080, H = 1920, OL = '#1d1a17', OW = 9;
const canvas = typeof document !== 'undefined' ? document.getElementById('c') : null;
const g = canvas ? canvas.getContext('2d') : null;
const L = typeof TALK !== 'undefined' ? TALK.lines : [];
const FONT = '"Kanit","Leelawadee UI",sans-serif';
/**
 * Clamp a number to the 0..1 range.
 * @param {number} v - input value
 * @returns {number} value in 0..1
 */
const clamp01 = v => Math.min(1, Math.max(0, v));
/**
 * Linear interpolation between two values.
 * @param {number} a - value at p = 0
 * @param {number} b - value at p = 1
 * @param {number} p - progress 0..1 (not clamped)
 * @returns {number} interpolated value
 */
const lerp = (a, b, p) => a + (b - a) * p;
const SEG_WORD = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
const SEG_GRAPH = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;

/* Drawing primitives — the vocabulary every scene is built from:
 * PATH(pts) polygon path · SHAPE(pts,fill) filled+outlined polygon · CIRC(x,y,r,fill,lw)
 * LIMB(x1,y1,x2,y2,w,fill) outlined round-cap segment · LINE(pts,w) polyline
 * RRECT(x,y,w,h,r,fill,lw) rounded rect · TXT(txt,x,y,size,color,align,weight) text (Kanit)
 * fitTXT(txt,x,y,maxW,size,color,align,weight) text shrunk to fit maxW
 * ease(p) cubic ease-out · easeInOut easeBack easeElastic springy motion curves · clamp01(v) · lerp(a,b,p) */
/**
 * Build a closed polygon path on the current canvas context.
 * @param {Array<[number, number]>} pts - vertices in px
 * @returns {void}
 */
const PATH = pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
/**
 * Fill a polygon and outline it.
 * @param {Array<[number, number]>} pts - vertices in px
 * @param {string} fill - CSS fill color
 * @returns {void}
 */
const SHAPE = (pts, fill) => { PATH(pts); g.fillStyle = fill; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.lineJoin = 'round'; g.stroke(); };
/**
 * Fill a circle with an optional outline.
 * @param {number} x - center x in px
 * @param {number} y - center y in px
 * @param {number} r - radius in px
 * @param {string} fill - CSS fill color
 * @param {number} [lw=OW] - outline width in px; 0 disables the outline
 * @returns {void}
 */
const CIRC = (x, y, r, fill, lw = OW) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = OL; g.stroke(); } };
/**
 * Draw an outlined round-cap segment, used for limbs.
 * @param {number} x1 - start x in px
 * @param {number} y1 - start y in px
 * @param {number} x2 - end x in px
 * @param {number} y2 - end y in px
 * @param {number} w - stroke width in px
 * @param {string} fill - CSS color of the segment body
 * @returns {void}
 */
const LIMB = (x1, y1, x2, y2, w, fill) => { g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = OL; g.lineWidth = w + OW * 2; g.stroke(); g.strokeStyle = fill; g.lineWidth = w; g.stroke(); };
/**
 * Stroke an open polyline with round caps.
 * @param {Array<[number, number]>} pts - vertices in px
 * @param {number} w - stroke width in px
 * @returns {void}
 */
const LINE = (pts, w) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineCap = 'round'; g.lineWidth = w; g.strokeStyle = OL; g.stroke(); };
/**
 * Fill a rounded rectangle with an optional outline.
 * @param {number} x - left edge in px
 * @param {number} y - top edge in px
 * @param {number} w - width in px
 * @param {number} h - height in px
 * @param {number} r - corner radius in px
 * @param {string} fill - CSS fill color
 * @param {number} [lw=OW] - outline width in px; 0 disables the outline
 * @returns {void}
 */
const RRECT = (x, y, w, h, r, fill, lw = OW) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = OL; g.stroke(); } };
/**
 * Draw one line of text in the brand font.
 * @param {string} txt - text to draw
 * @param {number} x - anchor x in px
 * @param {number} y - baseline y in px
 * @param {number} size - font size in px
 * @param {string} color - CSS fill color
 * @param {string} [align='center'] - canvas textAlign value
 * @param {number} [weight=700] - font weight 100..900
 * @returns {void}
 */
const TXT = (txt, x, y, size, color, align = 'center', weight = 700) => { g.font = `${weight} ${size}px ${FONT}`; g.textAlign = align; g.fillStyle = color; g.fillText(txt, x, y); };
/**
 * Draw text, shrinking the font in 2 px steps until it fits maxW (never below 24 px).
 * @param {string} txt - text to draw
 * @param {number} x - anchor x in px
 * @param {number} y - baseline y in px
 * @param {number} maxW - maximum rendered width in px
 * @param {number} size - starting font size in px
 * @param {string} color - CSS fill color
 * @param {string} [align='center'] - canvas textAlign value
 * @param {number} [weight=700] - font weight 100..900
 * @returns {number} font size actually used in px
 */
const fitTXT = (txt, x, y, maxW, size, color, align = 'center', weight = 700) => {
  let sz = size;
  g.font = `${weight} ${sz}px ${FONT}`;
  while (g.measureText(txt).width > maxW && sz > 24) { sz -= 2; g.font = `${weight} ${sz}px ${FONT}`; }
  TXT(txt, x, y, sz, color, align, weight);
  return sz;
};

// shared color/seeded-random primitives (used by atmosphere, people, and any feature)
/**
 * Deterministic pseudo-random value in [0, 1) for a seed. The same seed always yields the same value.
 * @param {number} seed - any finite number
 * @returns {number} value in [0, 1)
 */
const srnd = seed => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const finiteArg = (v, name) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`${name} must be a finite number, got ${String(v)}`);
  return v;
};
const hash32 = n => { n = Math.imul(n ^ (n >>> 16), 0x7feb352d); n = Math.imul(n ^ (n >>> 15), 0x846ca68b); return (n ^ (n >>> 16)) >>> 0; };
const NOISE_PERM = (() => {
  const p = Array.from({ length: 256 }, (_, k) => k);
  for (let k = 255; k > 0; k--) { const j = hash32(k ^ 0x5a17c3e9) % (k + 1); [p[k], p[j]] = [p[j], p[k]]; }
  return Array.from({ length: 512 }, (_, k) => p[k & 255]);
})();
const NOISE_GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0, 1], [0, -1]];
const NOISE_F2 = 0.3660254037844386, NOISE_G2 = 0.21132486540518713;
const noiseCorner = (cx, cy, gi) => {
  const t = .5 - cx * cx - cy * cy;
  if (t <= 0) return 0;
  const t2 = t * t;
  const grad = NOISE_GRAD[gi];
  return t2 * t2 * (grad[0] * cx + grad[1] * cy);
};
/**
 * Deterministic 2D simplex noise: a fixed field that is smooth, with values about -1..1.
 * The scale is the caller's: noise2(x * freq, y * freq) changes on a length of about 1 / freq.
 * @param {number} x - sample x, unitless
 * @param {number} y - sample y, unitless
 * @returns {number} noise value, about -1..1
 * @throws {TypeError} when x or y is not a finite number
 */
const noise2 = (x, y) => {
  finiteArg(x, 'noise2 x'); finiteArg(y, 'noise2 y');
  const s = (x + y) * NOISE_F2;
  const i = Math.floor(x + s), j = Math.floor(y + s);
  const u = (i + j) * NOISE_G2;
  const x0 = x - (i - u), y0 = y - (j - u);
  const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
  const x1 = x0 - i1 + NOISE_G2, y1 = y0 - j1 + NOISE_G2;
  const x2 = x0 - 1 + 2 * NOISE_G2, y2 = y0 - 1 + 2 * NOISE_G2;
  const ii = ((i % 256) + 256) % 256, jj = ((j % 256) + 256) % 256;
  const n = noiseCorner(x0, y0, NOISE_PERM[ii + NOISE_PERM[jj]] % 12)
    + noiseCorner(x1, y1, NOISE_PERM[ii + i1 + NOISE_PERM[jj + j1]] % 12)
    + noiseCorner(x2, y2, NOISE_PERM[ii + 1 + NOISE_PERM[jj + 1]] % 12);
  return 70 * n;
};

const hexRGB = (name, hex) => {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) throw new TypeError(`${name} must be a #rrggbb color, got ${String(hex)}`);
  const v = parseInt(hex.slice(1), 16);
  return [v >> 16, (v >> 8) & 255, v & 255];
};
/**
 * Mix two #rrggbb colors and return an rgb() string.
 * @param {string} a - start color as #rrggbb
 * @param {string} b - end color as #rrggbb
 * @param {number} p - mix amount, clamped to 0..1 (0 = a, 1 = b)
 * @returns {string} rgb(r,g,b) CSS color
 * @throws {TypeError} when a or b is not #rrggbb, or p is not a finite number
 */
function mixHex(a, b, p) {
  const [ar, ag, ab] = hexRGB('mixHex a', a), [br, bg, bb] = hexRGB('mixHex b', b);
  const q = clamp01(finiteArg(p, 'mixHex p'));
  return `rgb(${Math.round(lerp(ar, br, q))},${Math.round(lerp(ag, bg, q))},${Math.round(lerp(ab, bb, q))})`;
}

/**
 * Convert a #rrggbb color to rgba() with the given alpha.
 * @param {string} hex - color as #rrggbb
 * @param {number} a - alpha, clamped to 0..1
 * @returns {string} CSS color
 * @throws {TypeError} when hex is not #rrggbb, or a is not a finite number
 */
function hexA(hex, a) {
  const [cr, cg, cb] = hexRGB('hexA color', hex);
  return `rgba(${cr},${cg},${cb},${clamp01(finiteArg(a, 'hexA alpha'))})`;
}

Object.assign(globalThis, { W,H,OL,OW,g,L,FONT,clamp01,lerp,SEG_WORD,SEG_GRAPH,PATH,SHAPE,CIRC,LIMB,LINE,RRECT,TXT,fitTXT,srnd,noise2,mixHex,hexA });
})();
