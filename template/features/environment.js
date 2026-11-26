/**
 * @file features/environment.js — scene environment — lighting (rim/vig/tint), weather (rain), and sets (wall/floorY/win/city/stars/lamp).
 * Part of the aiyu template runtime. Layer rules: core ← features ← story.
 */

(() => {

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

Object.assign(globalThis, { rim,vig,tint,rain,circuitField,wall,floorY,win,glow,city,stars,lamp });
})();
