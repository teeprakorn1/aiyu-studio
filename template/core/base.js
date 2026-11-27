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

/**
 * Mix two #rrggbb colors and return an rgb() string.
 * @param {string} a - start color as #rrggbb
 * @param {string} b - end color as #rrggbb
 * @param {number} p - mix amount 0..1 (0 = a, 1 = b)
 * @returns {string} rgb(r,g,b) CSS color
 */
function mixHex(a, b, p) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp(pa >> 16, pb >> 16, p));
  const gg = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, p));
  const bl = Math.round(lerp(pa & 255, pb & 255, p));
  return `rgb(${r},${gg},${bl})`;
}

/**
 * Convert a #rrggbb color to rgba() with the given alpha. Input that is not #rrggbb is returned unchanged.
 * @param {string} hex - color as #rrggbb
 * @param {number} a - alpha 0..1
 * @returns {string} CSS color
 */
function hexA(hex, a) {
  if (!hex.startsWith('#')) return hex;
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`;
}

Object.assign(globalThis, { W,H,OL,OW,g,L,FONT,clamp01,lerp,SEG_WORD,SEG_GRAPH,PATH,SHAPE,CIRC,LIMB,LINE,RRECT,TXT,fitTXT,srnd,mixHex,hexA });
})();
