/**
 * @file features/environment.js — scene environment — lighting (rim/vig/tint), weather (rain), and sets (wall/floorY/win/city/stars/lamp).
 * Part of the aiyu template runtime. Layer rules: core ← features ← story.
 */

(() => {

/**
 * Rim light: two soft arcs of light along one edge of a figure.
 * @param {number} x - figure anchor x in px
 * @param {number} y - figure anchor y in px (feet baseline)
 * @param {number} s - scale factor (1 = full figure height)
 * @param {number} [side=1] - 1 lights the right edge, -1 lights the left edge
 * @param {string} [col='rgba(180,200,255,.28)'] - CSS stroke color
 * @returns {void}
 */
const rim = (x, y, s, side = 1, col = 'rgba(180,200,255,.28)') => {
  g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = col; g.lineWidth = 14; g.lineCap = 'round';
  g.beginPath(); g.arc(side * 70, -440, 90, side > 0 ? -1.2 : Math.PI + .4, side > 0 ? .9 : Math.PI + 1.5); g.stroke();
  g.beginPath(); g.arc(side * 60, -300, 120, side > 0 ? -1.1 : Math.PI + .5, side > 0 ? .6 : Math.PI + 1.4); g.stroke();
  g.restore();
};

/**
 * Radial vignette that darkens the frame edges.
 * @returns {void}
 */
const vig = () => {
  const v = g.createRadialGradient(W / 2, H * .55, H * .28, W / 2, H * .55, H * .75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.34)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
};

/**
 * Full-frame translucent color wash.
 * @param {string} rgb - comma-separated rgb triplet, e.g. '4,4,10'
 * @param {number} a - alpha 0..1
 * @returns {void}
 */
const tint = (rgb, a) => { g.fillStyle = `rgba(${rgb},${a})`; g.fillRect(0, 0, W, H); };

/**
 * Falling rain streaks. Positions are a pure function of t, so frames stay deterministic.
 * @param {number} [alpha=.18] - streak opacity 0..1
 * @param {number} [n=34] - streak count
 * @param {number} [t=g.__t] - timeline seconds; scenes pass o.t
 * @returns {void}
 */
function rain(alpha = .18, n = 34, t = g.__t || 0) {
  g.save(); g.globalAlpha = alpha; g.strokeStyle = '#9fb5c9'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = (i * 157 + t * 34) % (W + 180) - 90, y = (i * 241 + t * 190) % 1350;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 18, y + 54); g.stroke();
  }
  g.restore();
}

/**
 * Faint circuit-board line motif spread across the frame.
 * @param {number} [alpha=.13] - opacity 0..1
 * @param {string} [col='118,185,0'] - comma-separated rgb triplet
 * @returns {void}
 */
function circuitField(alpha = .13, col = '118,185,0') {
  g.save(); g.globalAlpha = alpha; g.strokeStyle = `rgba(${col},.8)`; g.fillStyle = `rgba(${col},.9)`; g.lineWidth = 5; g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const x = 60 + (i * 181) % 920, y = 150 + (i * 263) % 1160, dx = 50 + (i * 37) % 80, dy = 42 + (i * 29) % 72;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y); g.lineTo(x + dx, y + dy); g.stroke();
    g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.beginPath(); g.arc(x + dx, y + dy, 7, 0, 7); g.fill();
  }
  g.restore();
}

/**
 * Vertical gradient filling the whole frame, used as a backdrop wall.
 * @param {string} top - CSS color at the top edge
 * @param {string} bottom - CSS color at the bottom edge
 * @returns {void}
 */
const wall = (top, bottom) => { const w = g.createLinearGradient(0, 0, 0, H); w.addColorStop(0, top); w.addColorStop(1, bottom); g.fillStyle = w; g.fillRect(0, 0, W, H); };

/**
 * Floor band from y to the bottom edge, with a horizon line on top.
 * @param {number} y - horizon y in px
 * @param {string} color - CSS fill color of the floor
 * @returns {void}
 */
const floorY = (y, color) => { g.fillStyle = color; g.fillRect(0, y, W, H - y); LINE([[0, y], [W, y]], 6); };

/**
 * Window with a sky fill, vertical mullions, and a transom.
 * @param {number} x - left edge in px
 * @param {number} y - top edge in px
 * @param {number} w - width in px
 * @param {number} h - height in px
 * @param {string} sky - CSS fill for the glass
 * @param {number} [div=2] - number of vertical panes
 * @returns {void}
 */
const win = (x, y, w, h, sky, div = 2) => {
  RRECT(x, y, w, h, 8, '#20242c');
  g.fillStyle = sky; g.fillRect(x + 10, y + 10, w - 20, h - 20);
  g.strokeStyle = OL; g.lineWidth = 6;
  for (let i = 1; i < div; i++) { g.beginPath(); g.moveTo(x + w * i / div, y); g.lineTo(x + w * i / div, y + h); g.stroke(); }
  g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
};

/**
 * Radial glow that fades to transparent at radius r.
 * @param {number} x - center x in px
 * @param {number} y - center y in px
 * @param {number} r - radius in px
 * @param {string} [rgb='255,220,140'] - comma-separated rgb triplet
 * @param {number} [a=.7] - alpha 0..1 at the center
 * @returns {void}
 */
const glow = (x, y, r, rgb = '255,220,140', a = .7) => {
  const s = g.createRadialGradient(x, y, 0, x, y, r);
  s.addColorStop(0, `rgba(${rgb},${a})`); s.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = s; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
};

/**
 * Row of simple building silhouettes.
 * @param {number} x - left edge in px
 * @param {number} y - top edge in px
 * @param {number} w - block width in px
 * @param {number} h - block height in px
 * @param {number} n - building count
 * @param {string} color - CSS fill color
 * @returns {void}
 */
const city = (x, y, w, h, n, color) => {
  for (let i = 0; i < n; i++) {
    const bx = x + (i * 73 % w), bh = 20 + (i * 97 % Math.max(30, h - 40));
    g.fillStyle = color; g.fillRect(bx, y + h - bh, 34 + (i * 41 % 40), bh);
  }
};

/**
 * Deterministic star dots over the upper sky.
 * @param {number} n - star count
 * @returns {void}
 */
const stars = n => { for (let i = 0; i < n; i++) CIRC((i * 197) % W, 60 + (i * 131) % 700, 2.5, 'rgba(255,255,255,.75)', 0); };

/**
 * Street lamp with a glowing head.
 * @param {number} x - pole base x in px
 * @param {number} y - pole base y in px
 * @param {number} [s=1] - scale factor (1 = 330 px pole)
 * @returns {void}
 */
const lamp = (x, y, s = 1) => {
  LINE([[x, y], [x, y - 330 * s]], 10);
  g.beginPath(); g.moveTo(x, y - 330 * s); g.quadraticCurveTo(x + 60 * s, y - 350 * s, x + 60 * s, y - 300 * s);
  g.lineWidth = 9; g.strokeStyle = OL; g.stroke();
  CIRC(x + 60 * s, y - 285 * s, 20, '#c94f3d'); glow(x + 60 * s, y - 285 * s, 110, '255,120,80', .55);
};

Object.assign(globalThis, { rim,vig,tint,rain,circuitField,wall,floorY,win,glow,city,stars,lamp });
})();
