/**
 * @file features/cards.js — card props — nameCard/newsCard/emailCard/quoteCard/pop/chip/chartCard.
 * Part of the aiyu template runtime. Layer rules: core ← features ← story.
 */

/**
 * Caption card with a small character portrait — for introducing people.
 * @param {number} x @param {number} y @param {number} w
 * @param {string} id - CH character id for the portrait
 * @param {string} cap - name text @param {string} sub - subtitle/role @param {number} [p=1]
 */
function nameCard(x, y, w, id, cap, sub, p = 1) {
  const e = ease(p); if (!e) return;
  const h = w * 1.34, c = CH[id];
  g.save(); g.translate(x, y); g.rotate(.045); const sp = springy(p); g.scale(sp, sp); g.globalAlpha = e;
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
  g.save(); g.translate(x, y); g.rotate(rot); const sp = springy(p); g.scale(sp, sp); g.globalAlpha = e;
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
  g.save(); g.translate(x, y); const sp = springy(p); g.scale(sp, sp); g.globalAlpha = e;
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
  const s = springy(p);
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

