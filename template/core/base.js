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
 * ease(p) cubic ease-out · easeInOut easeBack easeElastic springy motion curves · clamp01(v) · lerp(a,b,p) */
const PATH = pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
const SHAPE = (pts, fill) => { PATH(pts); g.fillStyle = fill; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.lineJoin = 'round'; g.stroke(); };
const CIRC = (x, y, r, fill, lw = OW) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = OL; g.stroke(); } };
const LIMB = (x1, y1, x2, y2, w, fill) => { g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = OL; g.lineWidth = w + OW * 2; g.stroke(); g.strokeStyle = fill; g.lineWidth = w; g.stroke(); };
const LINE = (pts, w) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineCap = 'round'; g.lineWidth = w; g.strokeStyle = OL; g.stroke(); };
const RRECT = (x, y, w, h, r, fill, lw = OW) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = OL; g.stroke(); } };
const TXT = (s, x, y, size, fill, align = 'center', weight = 700) => { g.font = `${weight} ${size}px ${FONT}`; g.textAlign = align; g.fillStyle = fill; g.fillText(s, x, y); };

// shared color/seeded-random primitives (used by atmosphere, people, and any feature)
const srnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function mixHex(a, b, p) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp(pa >> 16, pb >> 16, p));
  const gg = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, p));
  const bl = Math.round(lerp(pa & 255, pb & 255, p));
  return `rgb(${r},${gg},${bl})`;
}

function hexA(hex, a) {
  if (!hex.startsWith('#')) return hex;
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`;
}

Object.assign(globalThis, { W,H,OL,OW,g,L,FONT,SUB_FRAME_MAX,SUB_PAD_X,SUB_STROKE,SUB_TEXT_MAX,SUB_BASE,SUB_MIN,SUB_MAX_ROWS,clamp01,lerp,SEG_WORD,SEG_GRAPH,PATH,SHAPE,CIRC,LIMB,LINE,RRECT,TXT,srnd,mixHex,hexA });
})();
