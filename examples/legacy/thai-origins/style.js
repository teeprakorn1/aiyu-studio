// style.js — thai-origins v2: cinematic archival cartography + period scenes
// Full visual redesign. Never edit rig.js — all helpers live here. Characters in people.js.

const FOOTNOTE_TEXT = 'ภาพและเสียงจำลอง · แผนที่และช่วงเวลาเป็นการประมาณ · เขตอำนาจโบราณไม่มีเส้นแดนแน่นอน';

// ── Seeded randomness (deterministic, no flicker) ─────────
const srnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ── Color helpers ─────────────────────────────────────────
function mixHex(a, b, p) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp(pa >> 16, pb >> 16, p));
  const gg = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, p));
  const bl = Math.round(lerp(pa & 255, pb & 255, p));
  return `rgb(${r},${gg},${bl})`;
}

// ── Palettes ──────────────────────────────────────────────
const PAL = {
  mapSea0: '#0B1B2A', mapSea1: '#03080F', shelf: '#3A7280',
  landHi: '#35513B', landMid: '#263B2D', landLo: '#16251F',
  coast: '#8FAE9E', riverMaj: '#4F89A6', riverGlint: '#93C7D6',
  gold: '#F0BE61', goldHi: '#FFE1A0', bronze: '#9A672C',
  teal: '#67D6C2', copper: '#C77A4A', coral: '#E35E55', jade: '#9ACB7A',
  ivory: '#F2E8D5', muted: '#8FA09B',
};
const DUSK = { sky0: '#151B2F', sky1: '#342D45', sky2: '#87513C', sky3: '#D99154', water0: '#243846', water1: '#0B1720' };
const NIGHT = { sky0: '#071C2B', sky1: '#16414E', land: '#17352E', water: '#0E5666', fire: '#FFB84D', ivory: '#E8F0DF' };
const PARCH = { paper: '#D6C39A', land: '#B78A55', water: '#5F8C85', ink: '#3B2A1D', cinnabar: '#B84430', gold: '#C79A3B' };

// ── Sky / atmosphere / frame treatments ───────────────────
function skyStops(stops, y0 = 0, y1 = H) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([p, c]) => gr.addColorStop(p, c));
  g.fillStyle = gr;
  g.fillRect(-400, -400, W + 800, H + 800);
}
function hazeBand(y, h, color, a) {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, `rgba(${color},0)`);
  gr.addColorStop(.5, `rgba(${color},${a})`);
  gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr;
  g.fillRect(-400, y, W + 800, h);
}
function starField(n, seed, yMax, t) {
  for (let i = 0; i < n; i++) {
    const x = srnd(seed + i * 2) * 1200 - 60, y = 40 + srnd(seed + i * 2 + 1) * yMax;
    const tw = .5 + .5 * Math.sin(t * (1 + srnd(i) * 2) + i * 2.4);
    const r = .8 + srnd(seed + i * 3) * 1.6;
    CIRC(x, y, r, `rgba(232,240,223,${.2 + .55 * tw})`, 0);
  }
}
// procedural grain: offscreen tile, drawn tiled at low alpha
const GRAIN = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const cx = c.getContext('2d');
  const img = cx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + srnd(i) * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  return c;
})();
function grainLayer(alpha = .035) {
  g.save();
  g.globalAlpha = alpha;
  g.globalCompositeOperation = 'overlay';
  const pat = g.createPattern(GRAIN, 'repeat');
  g.fillStyle = pat;
  g.fillRect(0, 0, W, H);
  g.restore();
}
function screenVig(strength = .3, fy = .52) {
  const v = g.createRadialGradient(W / 2, H * fy, H * .3, W / 2, H * fy, H * .78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,${strength})`);
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
}
function captionScrim(a = .5) {
  const gr = g.createLinearGradient(0, 1180, 0, 1560);
  gr.addColorStop(0, 'rgba(4,6,10,0)');
  gr.addColorStop(.5, `rgba(4,6,10,${a * .7})`);
  gr.addColorStop(1, `rgba(4,6,10,${a})`);
  g.fillStyle = gr;
  g.fillRect(0, 1180, W, 740);
}
function focusGlow(x, y, r, col, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${col},${a})`);
  gr.addColorStop(.5, `rgba(${col},${a * .4})`);
  gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

// ── Typography helpers ────────────────────────────────────
function TXTW(s, x, y, size, fill, align = 'center', weight = 700) {
  g.save();
  g.font = `${weight} ${size}px ${FONT}`;
  g.textAlign = align;
  g.shadowColor = 'rgba(0,0,0,.7)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 2;
  g.fillStyle = fill;
  g.fillText(s, x, y);
  g.restore();
}
function labelPlate(s, x, y, size = 26, col = '#F2E8D5', accent = null) {
  g.save();
  g.font = `700 ${size}px ${FONT}`;
  const w = g.measureText(s).width;
  const px = x - w / 2 - 13, py = y - size - 12, pw = w + 26, ph = size + 20;
  g.fillStyle = 'rgba(5,10,14,.72)';
  g.beginPath(); g.roundRect(px, py, pw, ph, 8); g.fill();
  if (accent) {
    g.fillStyle = accent;
    g.beginPath(); g.roundRect(px, py, 5, ph, 2); g.fill();
  }
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 4;
  g.fillStyle = col;
  g.textAlign = 'center';
  g.fillText(s, x, y - 6);
  g.restore();
}

// ── Map projection & data paths ───────────────────────────
const MK = 60, MLON = 101, MLAT = 13, MCOS = Math.cos(13 * Math.PI / 180);
const MX = lon => 540 + MK * MCOS * (lon - MLON);
const MY = lat => 900 - MK * (lat - MLAT);

const CITY = {
  nakhonpathom: { lon: 100.06, lat: 13.82, n: 'นครปฐม' },
  uthong:       { lon: 99.88,  lat: 14.37, n: 'อู่ทอง' },
  sithep:       { lon: 101.15, lat: 15.47, n: 'ศรีเทพ' },
  lavo:         { lon: 100.61, lat: 14.80, n: 'ละโว้' },
  hari:         { lon: 99.01,  lat: 18.58, n: 'หริภุญชัย' },
  sukhothai:    { lon: 99.70,  lat: 17.02, n: 'สุโขทัย' },
  sisat:        { lon: 99.79,  lat: 17.43, n: 'ศรีสัชนาลัย' },
  chaliang:     { lon: 99.86,  lat: 17.36, n: 'เชลียง' },
  ayutthaya:    { lon: 100.56, lat: 14.35, n: 'อยุธยา' },
  vientiane:    { lon: 102.61, lat: 17.96, n: 'เวียงจันทน์' },
  angkor:       { lon: 103.86, lat: 13.44, n: 'เมืองพระนคร' },
  mottama:      { lon: 97.60,  lat: 16.53, n: 'เมาะตะมะ' },
};

const LAND_P = [], COAST_P = [], RIVER_P = {}, LAND_ALL = new Path2D();
MAPDATA.land.forEach(ring => {
  const p = new Path2D();
  ring.forEach(([lo, la], i) => { const x = MX(lo), y = MY(la); i ? p.lineTo(x, y) : p.moveTo(x, y); });
  p.closePath();
  LAND_P.push(p);
  LAND_ALL.addPath(p);
});
MAPDATA.coast.forEach(line => {
  // drop tiny closed islet rings (they render as scratchy fans, e.g. Mekong delta)
  const [f0, l0] = [line[0], line[line.length - 1]];
  const closed = Math.abs(f0[0] - l0[0]) < .01 && Math.abs(f0[1] - l0[1]) < .01;
  if (closed && line.length < 60) {
    let minLo = 1e9, maxLo = -1e9, minLa = 1e9, maxLa = -1e9;
    line.forEach(([lo, la]) => { minLo = Math.min(minLo, lo); maxLo = Math.max(maxLo, lo); minLa = Math.min(minLa, la); maxLa = Math.max(maxLa, la); });
    if ((maxLo - minLo) + (maxLa - minLa) < 1.1) return;
  }
  const p = new Path2D();
  line.forEach(([lo, la], i) => { const x = MX(lo), y = MY(la); i ? p.lineTo(x, y) : p.moveTo(x, y); });
  COAST_P.push(p);
});
Object.keys(MAPDATA.rivers).forEach(name => {
  RIVER_P[name] = MAPDATA.rivers[name].map(line => {
    const p = new Path2D();
    line.forEach(([lo, la], i) => { const x = MX(lo), y = MY(la); i ? p.lineTo(x, y) : p.moveTo(x, y); });
    return p;
  });
});

// river hierarchy: width, alpha
const RIVER_H = {
  'Mekong': [4.2, .5], 'Chao Phraya': [3.4, .5], 'Salween': [2.4, .38],
  'Mun': [2.4, .38], 'Chi': [2, .32], 'Ping': [2.2, .38], 'Yom': [2, .32],
  'Mae Klong': [1.7, .28], 'Tonle Sap': [1.7, .28],
};

// terrain ridge ribbons in lon/lat polylines: [points, width, alpha]
const RIDGES = [
  [[[97.4, 21], [98.2, 20], [99.2, 19.2], [100, 18.4]], 90, .14],   // northern highlands
  [[[98.3, 17.5], [98.5, 15.5], [98.7, 13.5], [99, 11.5]], 70, .12], // tenasserim
  [[[103.6, 19.5], [104.6, 17.5], [105.2, 15.5], [105.6, 13.8]], 80, .12], // annamite
  [[[100.6, 18.6], [101.2, 17.4], [101.6, 16.4]], 55, .1],           // phetchabun hint
];

function mapBase(o, opts = {}) {
  const dim = opts.dim || 0;
  // ocean — full bleed beyond camera
  const gr = g.createLinearGradient(0, -300, 0, 1800);
  gr.addColorStop(0, PAL.mapSea0);
  gr.addColorStop(1, PAL.mapSea1);
  g.fillStyle = gr;
  g.fillRect(-700, -500, W + 1400, H + 1000);
  // coastal shelf glow (3 passes)
  COAST_P.forEach(p => {
    g.strokeStyle = PAL.shelf;
    g.lineCap = 'round';
    [28, 16, 8].forEach((w, i) => {
      g.globalAlpha = [.025, .04, .06][i];
      g.lineWidth = w;
      g.stroke(p);
    });
    g.globalAlpha = 1;
  });
  // land shadow
  g.save();
  g.shadowColor = 'rgba(0,0,0,.5)';
  g.shadowBlur = 22;
  g.fillStyle = PAL.landLo;
  LAND_P.forEach(p => g.fill(p));
  g.restore();
  // land vertical gradient fill, clipped to land
  g.save();
  g.clip(LAND_ALL);
  const lg = g.createLinearGradient(0, MY(21), 0, MY(5));
  lg.addColorStop(0, PAL.landHi);
  lg.addColorStop(.55, PAL.landMid);
  lg.addColorStop(1, PAL.landLo);
  g.fillStyle = lg;
  g.fillRect(-700, -500, W + 1400, H + 1000);
  // terrain: hachure mountain marks along ridge lines (archival cartography style)
  RIDGES.forEach(([pts, w, a], ri) => {
    const px = pts.map(([lo, la]) => [MX(lo), MY(la)]);
    const samples = [];
    for (let s = 0; s < px.length - 1; s++) {
      const [x1, y1] = px[s], [x2, y2] = px[s + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      const n = Math.max(1, Math.floor(len / 18));
      for (let i = 0; i < n; i++) {
        const tt = i / n;
        samples.push([x1 + (x2 - x1) * tt, y1 + (y2 - y1) * tt]);
      }
    }
    samples.forEach(([x, y], i) => {
      const j1 = srnd(ri * 1000 + i * 3), j2 = srnd(ri * 1000 + i * 3 + 1), j3 = srnd(ri * 1000 + i * 3 + 2);
      const sc = w / 70;
      const hw = (13 + j1 * 9) * sc;
      const hh = (9 + j2 * 5) * sc;
      g.save();
      g.translate(x + (j3 - .5) * 16, y + (j1 - .5) * 12);
      g.rotate((j2 - .5) * .35);
      g.fillStyle = `rgba(8,18,12,${a * 2.8})`;
      g.beginPath();
      g.moveTo(-hw, 0);
      g.quadraticCurveTo(-hw * .42, -hh * .92, -hw * .08, -hh);
      g.quadraticCurveTo(hw * .3, -hh * .8, hw, 0);
      g.closePath(); g.fill();
      g.strokeStyle = `rgba(165,190,135,${a * 1.5})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(-hw, -1);
      g.quadraticCurveTo(-hw * .42, -hh * .92, -hw * .08, -hh);
      g.stroke();
      g.restore();
    });
  });
  g.restore();
  // rivers: dark understroke then main
  Object.keys(RIVER_H).forEach(name => {
    const [w, a] = RIVER_H[name];
    (RIVER_P[name] || []).forEach(p => {
      g.strokeStyle = 'rgba(6,14,18,.5)';
      g.lineWidth = w + 2.4;
      g.lineCap = 'round';
      g.stroke(p);
      g.strokeStyle = PAL.riverMaj;
      g.globalAlpha = a;
      g.lineWidth = w;
      g.stroke(p);
      g.globalAlpha = 1;
    });
  });
  // crisp coastline
  g.strokeStyle = PAL.coast;
  g.globalAlpha = .55;
  g.lineWidth = 1.4;
  COAST_P.forEach(p => g.stroke(p));
  g.globalAlpha = 1;
  // faint graticule
  g.save();
  g.strokeStyle = 'rgba(170,200,190,.05)';
  g.lineWidth = 1;
  for (let lon = 96; lon <= 107; lon += 2) {
    g.beginPath(); g.moveTo(MX(lon), -300); g.lineTo(MX(lon), 1800); g.stroke();
  }
  for (let lat = 4; lat <= 23; lat += 2) {
    g.beginPath(); g.moveTo(-400, MY(lat)); g.lineTo(1480, MY(lat)); g.stroke();
  }
  g.restore();
  if (dim) {
    g.fillStyle = `rgba(3,6,10,${dim})`;
    g.fillRect(-700, -500, W + 1400, H + 1000);
  }
}

// organic influence blob — not an ellipse
function organicBlob(cx, cy, rx, ry, rot, col, p, seed = 1) {
  if (p <= 0) return;
  const N = 22;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const mod = 1 + .09 * Math.sin(3 * a + seed * 2.3) + .05 * Math.sin(5 * a + seed * 4.1);
    pts.push([Math.cos(a) * rx * mod, Math.sin(a) * ry * mod]);
  }
  const trace = () => {
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const [nx, ny] = pts[(i + 1) % N];
      const mx = (x + nx) / 2, my = (y + ny) / 2;
      if (!i) g.moveTo(mx, my);
      else {
        const [px2, py2] = pts[(i - 1 + N) % N];
        const pmx = (px2 + x) / 2, pmy = (py2 + y) / 2;
        g.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
      }
    });
    g.closePath();
  };
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.scale(Math.min(1, .6 + .4 * ease(p)), Math.min(1, .6 + .4 * ease(p)));
  // radial fill
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
  gr.addColorStop(0, col + '24');
  gr.addColorStop(.7, col + '10');
  gr.addColorStop(1, col + '00');
  g.globalAlpha = p;
  trace();
  g.fillStyle = gr;
  g.fill();
  // thin dashed edge
  trace();
  g.strokeStyle = col;
  g.globalAlpha = p * .5;
  g.lineWidth = 2.2;
  g.setLineDash([7, 9]);
  g.lineDashOffset = -(g.__t || 0) * 6;
  g.stroke();
  g.setLineDash([]);
  g.restore();
}

// hex color + alpha → rgba string
function hexA(hex, a) {
  if (!hex.startsWith('#')) return hex;
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`;
}

// quadratic bezier point helper
function qbPoint(x1, y1, cx, cy, x2, y2, t) {
  const xa = lerp(x1, cx, t), ya = lerp(y1, cy, t);
  const xb = lerp(cx, x2, t), yb = lerp(cy, y2, t);
  return [lerp(xa, xb, t), lerp(ya, yb, t)];
}

// tapered luminous flow path with traveling particles
function flowPath(x1, y1, cx, cy, x2, y2, col, w, p, o, seed = 0) {
  if (p <= 0) return;
  const N = 34, upto = Math.max(2, Math.floor(N * p));
  g.save();
  g.lineCap = 'round';
  // glow pass
  g.shadowColor = col;
  g.shadowBlur = 18;
  g.globalAlpha = .5 * Math.min(1, p * 1.5);
  for (let i = 1; i <= upto; i++) {
    const t0 = (i - 1) / N, t1 = i / N;
    const [ax, ay] = qbPoint(x1, y1, cx, cy, x2, y2, t0);
    const [bx, by] = qbPoint(x1, y1, cx, cy, x2, y2, t1);
    g.strokeStyle = col;
    g.lineWidth = lerp(w * 1.15, w * .5, t0) + 5;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  }
  g.shadowBlur = 0;
  // core pass
  g.globalAlpha = .95 * Math.min(1, p * 1.5);
  for (let i = 1; i <= upto; i++) {
    const t0 = (i - 1) / N, t1 = i / N;
    const [ax, ay] = qbPoint(x1, y1, cx, cy, x2, y2, t0);
    const [bx, by] = qbPoint(x1, y1, cx, cy, x2, y2, t1);
    g.strokeStyle = col;
    g.lineWidth = lerp(w * 1.15, w * .5, t0);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  }
  // pale inner highlight
  g.globalAlpha = .35 * Math.min(1, p * 1.5);
  g.strokeStyle = '#FFF4DC';
  for (let i = 1; i <= upto; i++) {
    const t0 = (i - 1) / N, t1 = i / N;
    const [ax, ay] = qbPoint(x1, y1, cx, cy, x2, y2, t0);
    const [bx, by] = qbPoint(x1, y1, cx, cy, x2, y2, t1);
    g.lineWidth = lerp(w * .45, w * .18, t0);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  }
  // traveling particles
  if (o) {
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      const tt = ((o.t * .25 + k * .25 + seed * .13) % 1);
      if (tt > p) continue;
      const [px, py] = qbPoint(x1, y1, cx, cy, x2, y2, tt);
      const a = .6 * (1 - tt) * Math.min(1, p * 1.5);
      CIRC(px, py, lerp(w * .9, w * .4, tt), hexA(col, a), 0);
    }
    g.globalCompositeOperation = 'source-over';
  }
  // tapered barb arrowhead
  if (p > .9) {
    const [tx, ty] = qbPoint(x1, y1, cx, cy, x2, y2, 1);
    const [px2, py2] = qbPoint(x1, y1, cx, cy, x2, y2, .93);
    const a = Math.atan2(ty - py2, tx - px2);
    const ah = 13 + w * 1.5;
    g.globalAlpha = Math.min(1, (p - .9) * 10);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(tx, ty);
    g.quadraticCurveTo(tx - ah * .7 * Math.cos(a - .3), ty - ah * .7 * Math.sin(a - .3), tx - ah * Math.cos(a - .5), ty - ah * Math.sin(a - .5));
    g.lineTo(tx - ah * .42 * Math.cos(a), ty - ah * .42 * Math.sin(a));
    g.lineTo(tx - ah * Math.cos(a + .5), ty - ah * Math.sin(a + .5));
    g.quadraticCurveTo(tx - ah * .7 * Math.cos(a + .3), ty - ah * .7 * Math.sin(a + .3), tx, ty);
    g.closePath();
    g.fill();
  }
  g.restore();
}

// city marker: halo + bronze ring + bright core + entrance pulse
function cityMark(key, p, opts = {}) {
  if (p <= 0) return;
  const c = CITY[key];
  const x = MX(c.lon), y = MY(c.lat);
  const capital = opts.capital;
  const r = (capital ? 8 : 5.5) * Math.min(1, p * 1.4);
  g.save();
  g.globalAlpha = p;
  // halo
  const hr = capital ? 46 : 30;
  const gr = g.createRadialGradient(x, y, 0, x, y, hr);
  gr.addColorStop(0, 'rgba(240,190,97,.3)');
  gr.addColorStop(1, 'rgba(240,190,97,0)');
  g.fillStyle = gr;
  g.fillRect(x - hr, y - hr, hr * 2, hr * 2);
  // entrance pulse
  if (p < 1) {
    g.strokeStyle = `rgba(255,225,160,${.5 * (1 - p)})`;
    g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, 10 + p * 26, 0, Math.PI * 2); g.stroke();
  }
  // bronze ring + bright core
  g.strokeStyle = PAL.bronze;
  g.lineWidth = 2.4;
  g.beginPath(); g.arc(x, y, r + 3, 0, Math.PI * 2); g.stroke();
  CIRC(x, y, r, PAL.goldHi, 0);
  g.restore();
}


// focus camera: centers (lon,lat) at screen (sx,sy) with zoom z0→z1
function focusCam(o, lon, lat, sx, sy, z0, z1, fn, extra = {}) {
  const cx = MX(lon), cy = MY(lat);
  cam(o, {
    z0, z1, cx, cy,
    x0: sx - cx + (extra.dx || 0), x1: sx - cx + (extra.dx || 0),
    y0: sy - cy + (extra.dy || 0), y1: sy - cy + (extra.dy || 0),
    punch: extra.punch ?? .014,
    driftX: extra.driftX ?? 3,
    driftY: extra.driftY ?? 2,
  }, fn);
}

// ── Period props v2 ───────────────────────────────────────
function stupaDV(x, y, s, col = '#3A2E22', depth = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = col;
  // terraces with inset shading
  const tiers = [[70, 34], [54, 28], [38, 24]];
  let yy = 0;
  tiers.forEach(([w, h], i) => {
    SHAPE([[-w, yy], [w, yy], [w - 8, yy - h], [-w + 8, yy - h]], col);
    // brick lines
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
    for (let b = 1; b < 3; b++) {
      g.beginPath(); g.moveTo(-w + 6, yy - h * b / 3); g.lineTo(w - 6, yy - h * b / 3); g.stroke();
    }
    yy -= h;
  });
  // dome
  g.beginPath(); g.arc(0, yy, 28, Math.PI, 0); g.closePath();
  g.fillStyle = col; g.fill();
  g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
  // harmika + parasol mast
  RRECT(-9, yy - 40, 18, 12, 2, col, 3);
  g.fillStyle = col; g.fillRect(-2, yy - 76, 4, 38);
  g.fillStyle = '#55432F';
  [-52, -62, -72].forEach((dy, i) => { g.fillRect(-12 + i * 3, yy + dy, 24 - i * 6, 3.5); });
  g.restore();
}

function prangKH(x, y, s, col = '#33292A') {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = col;
  SHAPE([[-46, 0], [46, 0], [40, -24], [-40, -24]], col);
  // corncob body with ridge divisions
  g.beginPath();
  g.moveTo(-25, -24);
  g.bezierCurveTo(-29, -78, -13, -108, 0, -126);
  g.bezierCurveTo(13, -108, 29, -78, 25, -24);
  g.closePath();
  g.fill();
  g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
  // ridges
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2.5;
  [-46, -66, -86, -103].forEach(yy => {
    const p = (yy + 24) / -102;
    const half = 25 * (1 - p * .55);
    g.beginPath();
    g.moveTo(-half, yy); g.quadraticCurveTo(0, yy + 5, half, yy);
    g.stroke();
  });
  g.fillStyle = col;
  g.fillRect(-2.5, -140, 5, 15);
  g.restore();
}

function palmTree(x, y, s, col = '#16241A', seed = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  // curved trunk, thicker at base
  g.strokeStyle = col; g.lineCap = 'round';
  g.lineWidth = 9;
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(7, -52, 3, -96); g.stroke();
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(1, -46); g.quadraticCurveTo(6, -72, 3, -96); g.stroke();
  // asymmetric drooping fronds
  g.fillStyle = col;
  for (let i = 0; i < 8; i++) {
    const baseA = -Math.PI * .15 - i * (Math.PI * .85 / 7) + (srnd(seed + i) - .5) * .3;
    const len = 26 + srnd(seed + i + 20) * 14;
    const droop = .3 + Math.abs(Math.sin(baseA)) * .5;
    g.save();
    g.translate(3, -96);
    g.rotate(baseA + Math.PI / 2);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * .5, -5 - droop * 4, len, droop * 10);
    g.quadraticCurveTo(len * .55, droop * 3, 0, 3);
    g.closePath();
    g.fill();
    g.restore();
  }
  // coconut cluster
  CIRC(0, -90, 4, col, 0); CIRC(6, -87, 3.5, col, 0);
  g.restore();
}

function stiltHouse(x, y, s, wallC, roofC, lit, variant = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const w = 50 + variant * 8, roofW = w + 14, bodyH = 58, roofH = 40 + variant * 6;
  // stilts angled outward
  g.strokeStyle = '#241A12'; g.lineWidth = 6; g.lineCap = 'round';
  [-w * .7, 0, w * .7].forEach(xx => {
    g.beginPath(); g.moveTo(xx * .9, -38); g.lineTo(xx, 0); g.stroke();
  });
  // cross brace
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(-w * .6, -8); g.lineTo(w * .6, -30); g.stroke();
  // body
  SHAPE([[-w, -38], [w, -38], [w - 5, -38 - bodyH], [-w + 5, -38 - bodyH]], wallC);
  // gable
  g.fillStyle = wallC;
  SHAPE([[-w + 5, -38 - bodyH], [w - 5, -38 - bodyH], [0, -38 - bodyH - roofH * .6]], wallC);
  // roof with thickness + underside
  const ry = -38 - bodyH - roofH * .6;
  SHAPE([[-roofW, -38 - bodyH + 4], [roofW, -38 - bodyH + 4], [4, ry], [-4, ry]], roofC);
  g.fillStyle = 'rgba(0,0,0,.4)';
  g.beginPath(); g.moveTo(-roofW, -38 - bodyH + 4); g.lineTo(-w + 5, -38 - bodyH + 4); g.lineTo(-w + 5, -38 - bodyH + 9); g.lineTo(-roofW, -38 - bodyH + 9); g.closePath(); g.fill();
  // thatch strokes
  g.save();
  g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const tx = -roofW + 12 + i * (roofW * 2 - 24) / 4;
    g.beginPath(); g.moveTo(tx, -38 - bodyH + 2); g.lineTo(tx * .1, ry + 4); g.stroke();
  }
  g.restore();
  // windows with light spill
  if (lit) {
    [-w * .45, w * .2].forEach(wx => {
      g.fillStyle = 'rgba(255,190,90,.75)';
      g.fillRect(wx, -38 - bodyH + 16, 15, 19);
      g.strokeStyle = OL; g.lineWidth = 3;
      g.strokeRect(wx, -38 - bodyH + 16, 15, 19);
      // spill
      g.save();
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(wx + 7, -38 - bodyH + 25, 0, wx + 7, -38 - bodyH + 25, 34);
      gr.addColorStop(0, 'rgba(255,180,90,.22)');
      gr.addColorStop(1, 'rgba(255,180,90,0)');
      g.fillStyle = gr;
      g.fillRect(wx - 30, -38 - bodyH - 8, 75, 70);
      g.restore();
    });
  } else {
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.fillRect(-w * .45, -38 - bodyH + 16, 15, 19);
  }
  // ladder hint
  g.strokeStyle = '#241A12'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(w * .3, 0); g.lineTo(w * .42, -36); g.stroke();
  g.restore();
}

function longboat(x, y, s, t = 0, hullC = '#5A4630') {
  g.save(); g.translate(x, y); g.scale(s, s);
  // hull with raised prow/stern
  g.fillStyle = hullC;
  g.beginPath();
  g.moveTo(-86, -6);
  g.quadraticCurveTo(-78, -16, -66, -8);
  g.quadraticCurveTo(-58, 12, 0, 15);
  g.quadraticCurveTo(58, 12, 66, -8);
  g.quadraticCurveTo(78, -16, 86, -6);
  g.quadraticCurveTo(60, 5, 0, 6);
  g.quadraticCurveTo(-60, 5, -86, -6);
  g.closePath();
  g.fill();
  g.lineWidth = 4; g.strokeStyle = OL; g.stroke();
  // gunwale line
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-64, -4); g.quadraticCurveTo(0, 4, 64, -4); g.stroke();
  // seats
  [-30, 0, 30].forEach(sx => {
    g.beginPath(); g.moveTo(sx - 8, 0); g.lineTo(sx + 8, 0); g.stroke();
  });
  // wake
  g.strokeStyle = 'rgba(150,180,190,.18)'; g.lineWidth = 3;
  const wo = Math.sin(t * 1.3) * 6;
  g.beginPath(); g.moveTo(-96, 8); g.quadraticCurveTo(-120 + wo, 12, -140, 9); g.stroke();
  g.beginPath(); g.moveTo(96, 8); g.quadraticCurveTo(120 - wo, 12, 140, 9); g.stroke();
  g.restore();
}

function junkShip(x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  // hull: high stern (left), lower bow (right)
  g.fillStyle = '#4A3020';
  g.beginPath();
  g.moveTo(-92, -34);
  g.lineTo(-86, 2);
  g.quadraticCurveTo(-60, 24, 0, 26);
  g.quadraticCurveTo(66, 22, 88, -2);
  g.lineTo(80, -14);
  g.lineTo(-80, -10);
  g.closePath();
  g.fill();
  g.lineWidth = 4; g.strokeStyle = OL; g.stroke();
  // stern castle
  SHAPE([[-90, -34], [-58, -32], [-58, -52], [-90, -54]], '#3A281C');
  // waterline shadow
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.fillRect(-80, 8, 160, 8);
  // masts
  g.strokeStyle = '#2A1C12'; g.lineCap = 'round';
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(-8, -8); g.lineTo(-12, -140); g.stroke();
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(48, -6); g.lineTo(52, -108); g.stroke();
  // main lug sail with battens
  g.fillStyle = '#8A6A42';
  g.beginPath();
  g.moveTo(-12, -136);
  g.quadraticCurveTo(-52, -120, -64, -60);
  g.quadraticCurveTo(-40, -44, -4, -52);
  g.closePath();
  g.fill();
  g.lineWidth = 3.5; g.strokeStyle = OL; g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2.5;
  for (let i = 1; i <= 4; i++) {
    const yy = -136 + i * 20;
    g.beginPath();
    g.moveTo(-12 - i * 3, yy);
    g.quadraticCurveTo(-38 - i * 3, yy + 8, -60 + i * 2, yy + 16);
    g.stroke();
  }
  // fore sail
  g.fillStyle = '#7A5C38';
  g.beginPath();
  g.moveTo(52, -104);
  g.quadraticCurveTo(76, -88, 82, -44);
  g.quadraticCurveTo(64, -34, 46, -42);
  g.closePath();
  g.fill();
  g.lineWidth = 3; g.strokeStyle = OL; g.stroke();
  // rigging
  g.strokeStyle = 'rgba(20,14,10,.7)'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(-12, -140); g.lineTo(88, -2); g.stroke();
  g.beginPath(); g.moveTo(-12, -140); g.lineTo(-88, -34); g.stroke();
  // pennant
  g.fillStyle = '#B84430';
  g.beginPath(); g.moveTo(-12, -140); g.lineTo(8, -134); g.lineTo(-12, -128); g.closePath(); g.fill();
  g.restore();
}

// water system: base gradient + curved broken ripples + reflections
function waterBody(y0, c0, c1) {
  const gr = g.createLinearGradient(0, y0, 0, H + 200);
  gr.addColorStop(0, c0);
  gr.addColorStop(1, c1);
  g.fillStyle = gr;
  g.fillRect(-200, y0, W + 400, H + 200 - y0);
}
function ripples(y0, y1, t, seed = 0, col = '150,180,190') {
  g.save();
  g.lineCap = 'round';
  const rows = Math.floor((y1 - y0) / 34);
  for (let i = 0; i < rows; i++) {
    const yy = y0 + i * 34 + srnd(seed + i) * 12;
    const depth = i / rows;
    const len = 30 + depth * 90;
    const count = 2 + Math.floor(srnd(seed + i + 50) * 3);
    for (let j = 0; j < count; j++) {
      const bx = srnd(seed + i * 7 + j * 13) * 1080;
      const drift = Math.sin(t * .5 + i * .8 + j) * 14;
      const a = (.05 + depth * .12) * (0.6 + .4 * Math.sin(t * .8 + i + j * 2));
      g.strokeStyle = `rgba(${col},${Math.max(0, a)})`;
      g.lineWidth = 2 + depth * 2;
      g.beginPath();
      g.moveTo(bx + drift - len / 2, yy);
      g.quadraticCurveTo(bx + drift, yy + 4, bx + drift + len / 2, yy);
      g.stroke();
    }
  }
  g.restore();
}
function lightReflection(x, y0, col, t, strength = .16) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const yy = y0 + 14 + i * 20;
    const wob = Math.sin(t * 1.3 + i * .9) * (5 + i * 1.2);
    const a = strength - i * .016;
    if (a <= 0) break;
    g.strokeStyle = `rgba(${col},${a})`;
    g.lineWidth = 9 - i * .7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x + wob - 12, yy);
    g.lineTo(x + wob + 12, yy);
    g.stroke();
  }
  g.restore();
}
// fireflies / dust motes
function motes(n, y0, y1, t, seed, col = '255,200,120') {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const bx = srnd(seed + i * 3) * 1080;
    const by = y0 + srnd(seed + i * 3 + 1) * (y1 - y0);
    const x = bx + Math.sin(t * .4 + i * 1.7) * 24;
    const y = by + Math.cos(t * .3 + i * 2.1) * 16;
    const tw = .3 + .7 * Math.abs(Math.sin(t * (0.8 + srnd(i)) + i * 2));
    CIRC(x, y, 1.6 + srnd(seed + i) * 1.4, `rgba(${col},${.35 * tw})`, 0);
  }
  g.restore();
}
function smokeColumn(x, y, t, seed = 0) {
  g.save();
  for (let i = 0; i < 7; i++) {
    const yy = y - i * 42 - (t * 18 % 42);
    const xx = x + Math.sin(t * .6 + i * .8) * (8 + i * 5);
    const a = .1 * (1 - i / 7);
    CIRC(xx, yy, 10 + i * 5, `rgba(200,190,180,${a})`, 0);
  }
  g.restore();
}


// rolling hill silhouette layer (atmospheric perspective color pre-mixed)
function hillsLayer(yBase, amp, seed, col) {
  const p1 = srnd(seed) * 6.28, p2 = srnd(seed + 1) * 6.28, p3 = srnd(seed + 2) * 6.28;
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(-140, yBase + 320);
  g.lineTo(-140, yBase);
  for (let x = -140; x <= 1220; x += 20) {
    const y = yBase
      - Math.abs(Math.sin(x * .0037 + p1)) * amp
      - Math.abs(Math.sin(x * .0109 + p2)) * amp * .42
      - Math.abs(Math.sin(x * .0291 + p3)) * amp * .16;
    g.lineTo(x, y);
  }
  g.lineTo(1220, yBase + 320);
  g.closePath();
  g.fill();
}

// canopy mass cluster — dark backlit vegetation
function treeMass(x, y, s, col, seed) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = col;
  for (let i = 0; i < 6; i++) {
    const bx = (srnd(seed * 10 + i * 2) - .5) * 110;
    const by = -16 - srnd(seed * 10 + i * 2 + 1) * 46;
    const br = 20 + srnd(seed + i * 7) * 22;
    g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
  }
  g.fillRect(-15, -32, 8, 34);
  g.fillRect(8, -28, 7, 30);
  g.restore();
}

// dusk cloud wisps — dark mass with warm lit underside
function cloudsDusk(list, t) {
  list.forEach(([x, y, w], i) => {
    const drift = Math.sin(t * .05 + i * 2.1) * 14;
    g.save();
    g.translate(x + drift, y);
    for (let k = 0; k < 6; k++) {
      const ex = (k / 5 - .5) * w + (srnd(i * 20 + k) - .5) * w * .14;
      const ey = (srnd(i * 20 + k + 9) - .5) * 14;
      const rw = w * (.22 + srnd(k * 5 + i) * .12);
      g.fillStyle = `rgba(24,18,32,${.09 + srnd(k * 3 + i) * .05})`;
      g.beginPath(); g.ellipse(ex, ey, rw, rw * .2, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  });
}

// distant bird flock — small flapping chevrons
function birdsFlock(x, y, n, t, seed) {
  g.strokeStyle = 'rgba(22,15,10,.5)';
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const bx = x + (srnd(seed + i * 3) - .5) * 280 + Math.sin(t * .3 + i) * 20;
    const by = y + (srnd(seed + i * 3 + 1) - .5) * 130 + Math.sin(t * .5 + i * 2) * 8;
    const s = 5 + srnd(seed + i * 3 + 2) * 5;
    const flap = Math.sin(t * 6 + i * 1.7) * 2.5;
    g.beginPath();
    g.moveTo(bx - s, by);
    g.quadraticCurveTo(bx - s * .4, by - s * .5 - flap, bx, by);
    g.quadraticCurveTo(bx + s * .4, by - s * .5 - flap, bx + s, by);
    g.stroke();
  }
}

// ── Scene 1: Hook — myth arrow + impact X (lines 0–1) ─────
function scHook(o) {
  focusCam(o, 100.6, 16.5, 540, 880, 1.12, 1.22, () => {
    mapBase(o, { dim: .3 });
    const p0 = rv(o, 0, 1.2);
    if (p0) {
      const dim = o.i >= 1 ? .3 : 1;
      g.save(); g.globalAlpha = dim;
      // long vertical descent: southern China → central plain
      flowPath(MX(100.4), MY(22.3), MX(100.0), MY(18.6), MX(100.55), MY(14.7), PAL.coral, 7, p0, o);
      g.restore();
      if (o.i === 0) labelPlate('จีนตอนใต้', MX(100.4) + 10, MY(21.7), 30, '#F0A8A0', PAL.coral);
    }
    const p1 = rv(o, 1, 1.6);
    if (p1) {
      // brush-like impact X, rotated, with glow
      const cx = MX(100.3), cy = MY(18.3), s = 105 * ease(p1);
      g.save();
      g.translate(cx, cy);
      g.rotate(.12);
      g.globalAlpha = Math.min(1, p1 * 2);
      // impact glow
      focusGlow(0, 0, 190, '227,94,85', .3 * Math.min(1, p1 * 1.5));
      // tapered strokes (two widths layered)
      const stroke = (x1, y1, x2, y2, wMax, col) => {
        const segs = 12;
        for (let i = 0; i < segs; i++) {
          const t0 = i / segs, t1 = (i + 1) / segs;
          const w = wMax * (1 - Math.abs(t0 - .5) * 1.2);
          g.strokeStyle = col;
          g.lineWidth = Math.max(4, w);
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(lerp(x1, x2, t0), lerp(y1, y2, t0));
          g.lineTo(lerp(x1, x2, t1), lerp(y1, y2, t1));
          g.stroke();
        }
      };
      stroke(-s, -s, s, s, 24, '#8E2F32');
      stroke(s, -s, -s, s, 24, '#8E2F32');
      const s2 = s * .96;
      stroke(-s2, -s2, s2, s2, 15, PAL.coral);
      stroke(s2, -s2, -s2, s2, 15, PAL.coral);
      g.restore();
    }
  });
  captionScrim(.45);
  screenVig(.32);
  grainLayer();
}

// ── Scene 2: The land before (lines 2–5) ──────────────────
function scLandBefore(o) {
  focusCam(o, 100.3, 15.1, 540, 830, 1.45, 1.62, () => {
    mapBase(o);
    focusGlow(MX(100.3), MY(14.7), 330, '240,190,97', .1);
    const p3 = rv(o, 3);
    if (p3) {
      organicBlob(MX(100.25), MY(14.5), 130, 95, -.3, '#F0BE61', p3, 3);
      if (p3 > .5) labelPlate('ทวารวดี', MX(100.05), MY(15.95), 30, PAL.gold, PAL.gold);
    }
    const p4 = rv(o, 4);
    if (p4) {
      const stag = k => Math.min(1, Math.max(0, (o.i === 4 ? o.lp * 2.2 - k * .5 : 1)));
      if (stag(0)) { cityMark('nakhonpathom', stag(0), { capital: true }); labelPlate('นครปฐม', MX(100.06), MY(13.82) + 44, 25); }
      if (stag(1)) { cityMark('uthong', stag(1)); labelPlate('อู่ทอง', MX(99.88) - 6, MY(14.37) - 34, 25); }
      if (stag(2)) { cityMark('sithep', stag(2)); labelPlate('ศรีเทพ', MX(101.15) + 24, MY(15.47) - 44, 25); }
    }
    const p5 = rv(o, 5);
    if (p5) {
      cityMark('lavo', p5, { capital: true });
      labelPlate('ละโว้', MX(100.61) + 10, MY(14.8) - 38, 26);
      cityMark('hari', p5, { capital: true });
      labelPlate('หริภุญชัย', MX(99.01) + 10, MY(18.58) - 36, 25);
      cityMark('angkor', Math.min(1, p5 * .8));
      labelPlate('เมืองพระนคร', MX(103.86), MY(13.44) + 42, 24, PAL.ivory);
      flowPath(MX(103.7), MY(13.6), MX(102.3), MY(13.9), MX(100.85), MY(14.65), PAL.copper, 3.5, p5, o, 2);
      organicBlob(MX(99.1), MY(18.55), 95, 72, .2, '#67D6C2', p5 * .8, 7);
    }
  });
  captionScrim(.45);
  screenVig(.3);
  grainLayer();
}

// ── Scene 3: Merchant in canal city (lines 6–8) ───────────
function scMerchant(o) {
  cam(o, { z0: 1.03, z1: 1.09, cy: 980, punch: .014, driftX: 4 }, () => {
    // layered dusk sky
    skyStops([[0, DUSK.sky0], [.42, DUSK.sky1], [.68, DUSK.sky2], [.82, DUSK.sky3]], 0, 1240);
    cloudsDusk([[230, 420, 320], [780, 540, 380], [430, 690, 250]], o.t);
    birdsFlock(520, 540, 5, o.t, 11);
    // low sun off-center
    const sunX = 700, sunY = 1010;
    focusGlow(sunX, sunY, 420, '255,180,100', .3);
    CIRC(sunX, sunY, 46, '#FFD9A0', 0);
    CIRC(sunX, sunY, 44, '#FFCF92', 0);
    hazeBand(950, 260, '217,145,84', .22);
    // distant mountain ridges in haze
    hillsLayer(1162, 130, 3, mixHex('#2A1E16', DUSK.sky2, .72));
    hillsLayer(1176, 78, 7, mixHex('#20160F', DUSK.sky2, .5));
    // far silhouettes mixed toward sky
    const farC = mixHex('#1A120C', DUSK.sky2, .55);
    const midC = mixHex('#1A120C', DUSK.sky2, .25);
    g.save();
    stupaDV(170, 1150, 1.6, farC);
    prangKH(905, 1160, 1.15, farC);
    palmTree(70, 1180, 1.5, mixHex('#16241A', DUSK.sky2, .5), 4);
    palmTree(1000, 1170, 1.3, mixHex('#16241A', DUSK.sky2, .5), 9);
    g.restore();
    hazeBand(1080, 180, '217,145,84', .16);
    // midground: dharmachakra moved away from merchant's head area
    dharmProp(790, 1195, 1.0, midC);
    palmTree(430, 1175, 1.15, midC, 14);
    // embankment walkway strip
    g.fillStyle = '#2E2118';
    g.fillRect(-100, 1210, 1280, 34);
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 3;
    for (let i = 0; i < 24; i++) {
      g.beginPath(); g.moveTo(i * 48 - 40, 1212); g.lineTo(i * 48 - 40, 1242); g.stroke();
    }
    // vegetation masses behind/between houses
    treeMass(285, 1212, 1.05, mixHex('#16241A', DUSK.sky2, .18), 5);
    treeMass(545, 1214, .85, mixHex('#16241A', DUSK.sky2, .18), 6);
    treeMass(775, 1210, .95, mixHex('#16241A', DUSK.sky2, .18), 7);
    // stilt houses row (midground)
    stiltHouse(150, 1206, 1.0, '#4A3A28', '#33241A', false, 0);
    stiltHouse(395, 1210, 1.15, '#4E3C28', '#33241A', true, 1);
    stiltHouse(645, 1204, .95, '#463622', '#2E2016', false, 2);
    stiltHouse(920, 1212, 1.1, '#4A3A28', '#33241A', true, 0);
    smokeColumn(420, 1080, o.t, 3);
    // monks walking on embankment — opaque, color-mixed, small
    const mx = 180 + (o.t * 22) % 760;
    personTH('monk', { x: mx, y: 1218, scale: .3, t: o.t, walk: true, walkSpeed: 1.2, look: 1, phase: 0 });
    personTH('monk', { x: mx - 70, y: 1218, scale: .29, t: o.t, walk: true, walkSpeed: 1.2, look: 1, phase: .5 });
    // water
    waterBody(1244, DUSK.water0, DUSK.water1);
    // sun reflection path
    lightReflection(sunX, 1244, '255,180,100', o.t, .2);
    lightReflection(400, 1244, '255,190,90', o.t + 2, .1);
    lightReflection(925, 1244, '255,190,90', o.t + 4, .1);
    ripples(1256, 1620, o.t, 5);
    // boats
    longboat(270 + Math.sin(o.t * .2) * 26, 1380, 1.05, o.t);
    longboat(790 - Math.sin(o.t * .16) * 30, 1470, 1.3, o.t + 2, '#52402C');
    // foreground reeds silhouette (bottom corners)
    g.save();
    g.fillStyle = 'rgba(8,10,8,.85)';
    for (let i = 0; i < 9; i++) {
      const bx = i < 5 ? 20 + i * 22 : 990 + (i - 5) * 22;
      const hh = 60 + srnd(i) * 90;
      g.beginPath();
      g.ellipse(bx, 1915 - hh / 2, 5, hh / 2, (srnd(i + 3) - .5) * .3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    // the merchant walks the embankment — feet above water edge, clear of captions
    const enter = Math.min(1, o.p * 2.2);
    const wx = lerp(1130, 600, ease(enter));
    personTH('merchant', {
      x: wx, y: 1206, scale: .62, t: o.t,
      walk: enter < 1, walkSpeed: 1.35, look: -1,
      blink: (o.t % 3.8) < .12, mood: o.i >= 8 ? 'worry' : 'neutral',
    });
  });
  captionScrim(.5);
  screenVig(.3);
  grainLayer();
  const p8 = rv(o, 8, 2);
  if (p8) {
    // question mark near his head, not floating in void
    pop('?', 700, 700, PAL.gold, p8, 110);
  }
}

// dharmachakra pillar prop
function dharmProp(x, y, s, col = '#3A2F22') {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = col;
  RRECT(-8, -66, 16, 66, 3, col, 4);
  CIRC(0, -88, 25, col, 4);
  CIRC(0, -88, 14, 'rgba(10,8,6,.9)', 0);
  for (let i = 0; i < 8; i++) {
    g.save(); g.translate(0, -88); g.rotate(i * Math.PI / 4);
    g.fillStyle = col; g.fillRect(-2, -23, 4, 20);
    g.restore();
  }
  CIRC(0, -88, 6, col, 0);
  RRECT(-33, -10, 20, 10, 4, col, 3);
  RRECT(13, -10, 20, 10, 4, col, 3);
  g.restore();
}

// ── Scene 4: Migration streams + mixing (lines 9–14) ──────
function scStreams(o) {
  focusCam(o, 100.7, 16.2, 540, 860, 1.3, 1.45, () => {
    mapBase(o, { dim: .1 });
    // memory of the settled land (dimmer)
    organicBlob(MX(100.25), MY(14.5), 130, 95, -.3, '#F0BE61', .3, 3);
    ['nakhonpathom', 'uthong', 'sithep', 'lavo', 'hari'].forEach(k => cityMark(k, .55));
    // main migration streams — curved along valleys, varied
    const p9 = rv(o, 9, 1.3);
    if (p9) {
      flowPath(MX(99.7), MY(22.2), MX(99.1), MY(19.9), MX(99.45), MY(17.3), PAL.teal, 4.5, p9, o, 1);
      flowPath(MX(100.7), MY(22.2), MX(100.45), MY(19.3), MX(100.2), MY(16.5), PAL.teal, 4.5, Math.min(1, p9 * 1.15), o, 2);
      flowPath(MX(101.9), MY(22.2), MX(101.95), MY(19.6), MX(101.55), MY(16.8), PAL.teal, 4, Math.min(1, p9 * .9), o, 3);
    }
    const p10 = rv(o, 10);
    if (p10) {
      flowPath(MX(99.2), MY(22.1), MX(98.85), MY(20.2), MX(99.0), MY(18.2), PAL.teal, 2.8, p10, o, 4);
      flowPath(MX(101.3), MY(22.1), MX(101.05), MY(20.0), MX(100.75), MY(17.9), PAL.teal, 2.8, p10, o, 5);
      flowPath(MX(102.7), MY(22.0), MX(102.45), MY(19.9), MX(102.15), MY(17.7), PAL.teal, 2.8, p10, o, 6);
    }
    // line 11: existing cities pulse — the land was not empty
    const p11 = rv(o, 11);
    if (p11) {
      const pulse = .5 + .5 * Math.sin(o.t * 3.5);
      ['nakhonpathom', 'uthong', 'lavo'].forEach(k => {
        const c = CITY[k], x = MX(c.lon), y = MY(c.lat);
        g.strokeStyle = `rgba(240,190,97,${p11 * (.25 + .35 * pulse)})`;
        g.lineWidth = 2.5;
        g.beginPath(); g.arc(x, y, 16 + pulse * 7, 0, Math.PI * 2); g.stroke();
      });
    }
    // lines 12-14: seeded mixing clusters, no rosettes
    const p12 = rv(o, 12, 1.2);
    if (p12) {
      const spots = ['nakhonpathom', 'uthong', 'lavo', 'sithep', 'hari'];
      const goldIn = ease(p12);
      const mixMore = o.i >= 13 ? rv(o, 13, 1.2) : 0;
      spots.forEach((k, si) => {
        const c = CITY[k], x = MX(c.lon), y = MY(c.lat);
        // density glow
        const gr = g.createRadialGradient(x, y, 0, x, y, 52);
        gr.addColorStop(0, `rgba(240,190,97,${.07 * p12})`);
        gr.addColorStop(1, 'rgba(240,190,97,0)');
        g.fillStyle = gr;
        g.fillRect(x - 52, y - 52, 104, 104);
        // teal locals — stable positions
        for (let i = 0; i < 7; i++) {
          const a = srnd(si * 100 + i * 2) * Math.PI * 2;
          const rr = 10 + srnd(si * 100 + i * 2 + 1) * 38;
          CIRC(x + Math.cos(a) * rr, y + Math.sin(a) * rr * .75, 3.6, `rgba(103,214,194,${.5 + srnd(i) * .3})`, 0);
        }
        // gold newcomers appearing + interspersing
        const n = Math.floor((5 + 8 * mixMore) * goldIn + 5 * mixMore);
        for (let i = 0; i < n; i++) {
          const a = srnd(si * 300 + i * 2 + 7) * Math.PI * 2;
          const spread = o.i >= 14 ? .72 : 1;
          const rr = (8 + srnd(si * 300 + i * 2 + 8) * 40) * spread;
          CIRC(x + Math.cos(a) * rr, y + Math.sin(a) * rr * .75, 3.2, `rgba(240,190,97,${.55 + srnd(i + 40) * .35})`, 0);
        }
      });
    }
  });
  captionScrim(.45);
  screenVig(.3);
  grainLayer();
}

// ── Scene 5: Sukhothai network (lines 15–16) ──────────────
function scSukhothai(o) {
  focusCam(o, 100.0, 16.9, 540, 830, 1.7, 1.9, () => {
    mapBase(o, { dim: .12 });
    focusGlow(MX(99.75), MY(17.2), 260, '240,190,97', .12);
    const p15 = rv(o, 15);
    if (p15) {
      organicBlob(MX(99.8), MY(17.3), 105, 82, .15, '#F0BE61', p15, 5);
      // curved network links, sequential
      const links = [
        ['sukhothai', 'sisat', .0], ['sisat', 'chaliang', .15], ['sukhothai', 'chaliang', .3],
        ['sukhothai', 'hari', .45], ['sukhothai', 'sithep', .6], ['sukhothai', 'lavo', .75],
      ];
      links.forEach(([a, b, d]) => {
        const lp = Math.min(1, Math.max(0, p15 * 1.6 - d));
        if (!lp) return;
        const [x1, y1] = [MX(CITY[a].lon), MY(CITY[a].lat)];
        const [x2, y2] = [MX(CITY[b].lon), MY(CITY[b].lat)];
        const mx = (x1 + x2) / 2 + (y2 - y1) * .12, my = (y1 + y2) / 2 - (x2 - x1) * .12;
        g.save();
        g.strokeStyle = `rgba(240,190,97,${.5 * lp})`;
        g.lineWidth = 2.5;
        g.lineCap = 'round';
        const N = 20, upto = Math.max(2, Math.floor(N * lp));
        g.beginPath();
        for (let i = 0; i <= upto; i++) {
          const [px, py] = qbPoint(x1, y1, mx, my, x2, y2, i / N);
          i ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.stroke();
        g.restore();
      });
      // node hierarchy
      cityMark('sukhothai', p15, { capital: true });
      cityMark('sisat', Math.min(1, p15 * 1.1));
      cityMark('chaliang', Math.min(1, p15 * 1.15));
      cityMark('hari', Math.min(1, p15 * .7));
      cityMark('sithep', Math.min(1, p15 * .6));
      cityMark('lavo', Math.min(1, p15 * .55));
      // separated labels with leaders
      labelPlate('สุโขทัย', MX(99.7) - 40, MY(17.02) + 52, 26, PAL.gold, PAL.gold);
      labelPlate('ศรีสัชนาลัย', MX(99.79) + 34, MY(17.43) - 46, 22);
      labelPlate('เชลียง', MX(99.86) + 46, MY(17.36) + 44, 22);
      // elephant-ringed chedi at sukhothai
      chediEle2(MX(99.7) - 52, MY(17.02) + 4, .3);
    }
    const p16 = rv(o, 16, 1.3);
    if (p16) {
      const tx = MX(99.75), ty = MY(17.2);
      flowPath(tx - 300, ty - 320, tx - 150, ty - 200, tx - 42, ty - 46, PAL.teal, 4, p16, o, 7);
      flowPath(tx + 330, ty - 260, tx + 170, ty - 150, tx + 46, ty - 38, PAL.gold, 4, p16, o, 8);
      flowPath(tx - 320, ty + 290, tx - 160, ty + 160, tx - 44, ty + 42, PAL.coral, 4, p16, o, 9);
      flowPath(tx + 300, ty + 300, tx + 155, ty + 160, tx + 44, ty + 44, PAL.jade, 4, p16, o, 10);
    }
  });
  captionScrim(.45);
  screenVig(.3);
  grainLayer();
}

function chediEle2(x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const col = '#5A4A34';
  g.fillStyle = col;
  SHAPE([[-56, 0], [56, 0], [50, -30], [-50, -30]], col);
  for (let i = -2; i <= 2; i++) RRECT(i * 22 - 7, -24, 14, 20, 3, col, 3);
  g.beginPath(); g.moveTo(-34, -30);
  g.bezierCurveTo(-36, -78, -16, -92, 0, -94);
  g.bezierCurveTo(16, -92, 36, -78, 34, -30);
  g.closePath(); g.fill();
  g.lineWidth = 4; g.strokeStyle = OL; g.stroke();
  g.beginPath(); g.moveTo(-8, -94); g.lineTo(0, -146); g.lineTo(8, -94); g.closePath();
  g.fillStyle = col; g.fill();
  g.restore();
}

// ── Scene 6: Ayutthaya port + resettlement inset (17–20) ──
function scAyutthaya(o) {
  cam(o, { z0: 1.03, z1: 1.09, cy: 980, punch: .014, driftX: 4 }, () => {
    skyStops([[0, '#0E1526'], [.4, '#2A3352'], [.68, '#6A4A44'], [.82, '#C98A54']], 0, 1240);
    const sunX = 380, sunY = 1030;
    focusGlow(sunX, sunY, 380, '255,180,110', .28);
    CIRC(sunX, sunY, 40, '#FFD9A0', 0);
    hazeBand(960, 240, '201,138,84', .2);
    starField(30, 77, 500, o.t);
    cloudsDusk([[640, 470, 350], [190, 620, 280], [870, 710, 290]], o.t);
    birdsFlock(600, 590, 4, o.t, 23);
    // distant hills across the river plain
    hillsLayer(1160, 115, 13, mixHex('#1E1410', '#6A4A44', .68));
    hillsLayer(1175, 66, 17, mixHex('#161010', '#6A4A44', .45));
    // island skyline silhouettes
    const farC = mixHex('#14100E', '#6A4A44', .5);
    const midC = mixHex('#14100E', '#6A4A44', .22);
    prangKH(280, 1165, 1.3, farC);
    prangKH(770, 1175, 1.0, farC);
    stupaDV(510, 1170, .95, farC);
    palmTree(90, 1190, 1.5, mixHex('#16241A', '#6A4A44', .45), 21);
    palmTree(990, 1180, 1.35, mixHex('#16241A', '#6A4A44', .45), 27);
    palmTree(630, 1178, 1.1, mixHex('#16241A', '#6A4A44', .45), 31);
    hazeBand(1100, 160, '201,138,84', .14);
    // pier diagonal (foreground right)
    g.save();
    g.fillStyle = '#4A3823';
    g.beginPath();
    g.moveTo(760, 1300); g.lineTo(1080, 1240); g.lineTo(1080, 1276); g.lineTo(770, 1338);
    g.closePath(); g.fill();
    // plank lines along the pier
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2.5;
    for (let i = 0; i < 9; i++) {
      const px = 772 + i * 36, py0 = 1298 - i * 6.75, py1 = 1336 - i * 6.9;
      g.beginPath(); g.moveTo(px, py0); g.lineTo(px + 8, py1); g.stroke();
    }
    // top edge highlight
    g.strokeStyle = 'rgba(255,190,120,.28)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(760, 1300); g.lineTo(1080, 1240); g.stroke();
    // support posts into water
    g.strokeStyle = '#2E2114'; g.lineWidth = 7;
    [[810, 1292], [900, 1275], [990, 1258], [1060, 1246]].forEach(([px, py]) => {
      g.beginPath(); g.moveTo(px, py + 20); g.lineTo(px + 3, py + 88); g.stroke();
    });
    // crates + sacks on pier
    RRECT(830, 1268, 34, 26, 3, '#5A4630', 3);
    RRECT(868, 1274, 28, 22, 3, '#6A5238', 3);
    g.beginPath(); g.ellipse(918, 1280, 16, 12, 0, 0, Math.PI * 2);
    g.fillStyle = '#7A6248'; g.fill(); g.lineWidth = 3; g.strokeStyle = OL; g.stroke();
    g.restore();
    // riverside foreign-quarter houses with pennants
    const penn = (x, y, col) => {
      g.fillStyle = '#2A2018'; g.fillRect(x - 2, y - 158, 4, 42);
      SHAPE([[x + 2, y - 158], [x + 32, y - 150], [x + 2, y - 140]], col);
    };
    treeMass(420, 1214, 1.0, mixHex('#10150E', '#6A4A44', .22), 15);
    treeMass(735, 1216, .85, mixHex('#10150E', '#6A4A44', .22), 16);
    treeMass(45, 1218, .8, mixHex('#10150E', '#6A4A44', .22), 17);
    stiltHouse(150, 1216, 1.0, '#4A3A28', '#33241A', true, 0); penn(150, 1216, '#B84430');
    stiltHouse(590, 1210, .95, '#463622', '#2E2016', true, 2); penn(590, 1210, '#E8E0D0');
    stiltHouse(920, 1218, 1.05, '#423220', '#2A1E14', false, 1); penn(920, 1218, '#3A6A4A');
    smokeColumn(610, 1090, o.t, 8);
    // water
    waterBody(1244, '#26313C', '#0D1218');
    lightReflection(sunX, 1244, '255,180,100', o.t, .18);
    lightReflection(150, 1244, '255,190,90', o.t + 1, .1);
    lightReflection(590, 1244, '255,190,90', o.t + 3, .1);
    ripples(1256, 1700, o.t, 12);
    // traffic
    longboat(210 + Math.sin(o.t * .2) * 30, 1370, 1.15, o.t, '#52402C');
    junkShip(520 + Math.sin(o.t * .1) * 16, 1372, 1.35);
    longboat(810 - Math.sin(o.t * .16) * 34, 1430, 1.25, o.t + 1.5);
    longboat(150 + Math.sin(o.t * .24) * 24, 1640, 1.5, o.t + 3);
    // worker silhouettes on pier
    personTH('laborer', { x: 950, y: 1266, scale: .34, t: o.t, walk: false, look: -1, phase: .3 });
    personTH('laborer', { x: 850, y: 1290, scale: .38, t: o.t + .5, walk: true, walkSpeed: 1.1, look: -1, phase: .7 });
    motes(14, 500, 1100, o.t, 40);
  });
  // parchment inset — real mini-map (lines 18-20)
  const p18 = rv(o, 18, 1.6);
  if (p18) parchmentInset(o, p18);
  captionScrim(.5);
  screenVig(.3);
  grainLayer();
}

// parchment mini-map of resettlement
function parchmentInset(o, p) {
  const iw = 400, ih = 460, ix = 64, iy = 560, e = ease(p);
  g.save();
  g.globalAlpha = e;
  // parchment card
  g.save();
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
  g.fillStyle = PARCH.paper;
  g.beginPath(); g.roundRect(ix, iy, iw, ih, 12); g.fill();
  g.restore();
  // fiber texture
  g.save();
  g.beginPath(); g.roundRect(ix, iy, iw, ih, 12); g.clip();
  g.strokeStyle = 'rgba(59,42,29,.05)'; g.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const fx = ix + srnd(i * 3) * iw, fy = iy + srnd(i * 3 + 1) * ih;
    g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + 20 + srnd(i) * 40, fy + (srnd(i + 5) - .5) * 14); g.stroke();
  }
  // mini real map: lon 99-104.5, lat 13-19 clipped into card
  const mmx = lo => ix + 24 + (lo - 99) / 5.5 * (iw - 48);
  const mmy = la => iy + 74 + (19 - la) / 6 * (ih - 160);
  // water tint
  g.fillStyle = 'rgba(95,140,133,.28)';
  g.fillRect(ix + 12, iy + 60, iw - 24, ih - 120);
  // land shape from real coast data (simplified strokes)
  g.save();
  g.translate(0, 0);
  MAPDATA.coast.slice(0, 40).forEach(line => {
    g.strokeStyle = PARCH.ink;
    g.globalAlpha = e * .5;
    g.lineWidth = 1.2;
    g.beginPath();
    let started = false;
    line.forEach(([lo, la]) => {
      if (lo < 98.6 || lo > 105 || la < 12.6 || la > 19.4) { started = false; return; }
      const x = mmx(lo), y = mmy(la);
      started ? g.lineTo(x, y) : g.moveTo(x, y);
      started = true;
    });
    g.stroke();
  });
  // rivers: chao phraya + mekong simplified
  ['Chao Phraya', 'Mekong'].forEach(name => {
    (MAPDATA.rivers[name] || []).forEach(line => {
      g.strokeStyle = PARCH.water;
      g.globalAlpha = e * .85;
      g.lineWidth = 2;
      g.beginPath();
      let started = false;
      line.forEach(([lo, la]) => {
        if (lo < 98.6 || lo > 105 || la < 12.6 || la > 19.4) { started = false; return; }
        const x = mmx(lo), y = mmy(la);
        started ? g.lineTo(x, y) : g.moveTo(x, y);
        started = true;
      });
      g.stroke();
    });
  });
  g.globalAlpha = e;
  // city markers
  const dotCity = (lo, la, col, r = 5) => {
    CIRC(mmx(lo), mmy(la), r, col, 2);
  };
  dotCity(CITY.vientiane.lon, CITY.vientiane.lat, PARCH.ink, 4);
  dotCity(CITY.ayutthaya.lon, CITY.ayutthaya.lat, PARCH.cinnabar, 6);
  g.fillStyle = PARCH.ink;
  g.font = `700 20px ${FONT}`;
  g.textAlign = 'center';
  g.fillText('เวียงจันทน์', mmx(CITY.vientiane.lon), mmy(CITY.vientiane.lat) - 10);
  g.fillText('อยุธยา', mmx(CITY.ayutthaya.lon), mmy(CITY.ayutthaya.lat) + 24);
  // forced migration: red curved arrows vientiane → central plain
  const arrowInk = (x1, y1, cx, cy, x2, y2, col, w, pp) => {
    const N = 24, upto = Math.max(2, Math.floor(N * pp));
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
    g.setLineDash([6, 5]);
    g.beginPath();
    for (let i = 0; i <= upto; i++) {
      const [px, py] = qbPoint(x1, y1, cx, cy, x2, y2, i / N);
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
    g.setLineDash([]);
    if (pp > .9) {
      const [tx, ty] = qbPoint(x1, y1, cx, cy, x2, y2, 1);
      const [qx2, qy2] = qbPoint(x1, y1, cx, cy, x2, y2, .92);
      const a = Math.atan2(ty - qy2, tx - qx2), ah = 10 + w;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(tx - ah * Math.cos(a - .5), ty - ah * Math.sin(a - .5));
      g.lineTo(tx - ah * Math.cos(a + .5), ty - ah * Math.sin(a + .5));
      g.closePath(); g.fill();
    }
  };
  const vx = mmx(CITY.vientiane.lon), vy = mmy(CITY.vientiane.lat);
  const ax = mmx(CITY.ayutthaya.lon), ay = mmy(CITY.ayutthaya.lat);
  arrowInk(vx, vy, (vx + ax) / 2 + 30, (vy + ay) / 2 - 20, ax + 20, ay - 10, PARCH.cinnabar, 3, p);
  arrowInk(vx + 6, vy + 10, (vx + ax) / 2 + 40, (vy + ay) / 2 + 20, ax + 30, ay + 20, PARCH.cinnabar, 2.2, Math.min(1, p * 1.1));
  // voluntary migration (line 20): green paths from west/north
  const p20 = rv(o, 20, 1.5);
  if (p20) {
    arrowInk(ix + 30, iy + 150, ix + 80, iy + 190, ax - 30, ay - 4, '#3A6A4A', 2.5, p20);
    arrowInk(ix + 60, iy + 90, ix + 110, iy + 140, ax - 16, ay - 20, '#3A6A4A', 2, p20);
  }
  g.restore();
  // title + legend in ink
  g.fillStyle = PARCH.ink;
  g.font = `800 27px ${FONT}`;
  g.textAlign = 'center';
  g.fillText('การย้ายถิ่นเข้ามา', ix + iw / 2, iy + 42);
  g.font = `600 19px ${FONT}`;
  g.textAlign = 'left';
  g.fillStyle = PARCH.cinnabar;
  g.fillText('— เทครัว (ถูกบังคับ)', ix + 30, iy + ih - 52);
  g.fillStyle = '#3A6A4A';
  g.fillText('— อพยพเอง', ix + 30, iy + ih - 24);
  g.restore();
}

// ── Scene 7: Closing — shared table, top-down (21–22) ─────
function scClosing(o) {
  cam(o, { z0: 1.03, z1: 1.1, cy: 1000, punch: .016, driftX: 3 }, () => {
    skyStops([[0, '#141019'], [.6, '#241A22'], [1, '#33241F']], 0, H);
    focusGlow(540, 950, 700, '255,190,110', .14);
    // woven runner under table
    g.save();
    g.translate(540, 970); g.rotate(.02);
    g.fillStyle = '#4A3428';
    g.beginPath(); g.roundRect(-400, -300, 800, 620, 18); g.fill();
    g.strokeStyle = 'rgba(201,165,78,.16)'; g.lineWidth = 2;
    for (let i = -8; i <= 8; i++) {
      g.beginPath(); g.moveTo(i * 48, -300); g.lineTo(i * 48 + 60, 320); g.stroke();
      g.beginPath(); g.moveTo(i * 48, 320); g.lineTo(i * 48 + 60, -300); g.stroke();
    }
    g.restore();
    // big round low table, top-down
    const tx = 540, ty = 970;
    g.save();
    // contact shadow
    g.fillStyle = 'rgba(0,0,0,.4)';
    g.beginPath(); g.ellipse(tx + 12, ty + 16, 330, 300, 0, 0, Math.PI * 2); g.fill();
    // wooden table
    const tg = g.createRadialGradient(tx - 60, ty - 60, 40, tx, ty, 330);
    tg.addColorStop(0, '#5A4230');
    tg.addColorStop(1, '#3A2A1C');
    g.fillStyle = tg;
    g.beginPath(); g.ellipse(tx, ty, 320, 290, 0, 0, Math.PI * 2); g.fill();
    g.lineWidth = 5; g.strokeStyle = '#241A12'; g.stroke();
    // wood rings hint
    g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2;
    [240, 180, 120].forEach(rr => {
      g.beginPath(); g.ellipse(tx, ty, rr, rr * .88, 0, 0, Math.PI * 2); g.stroke();
    });
    // central rice bowl
    CIRC(tx, ty - 20, 64, '#E8E0D0', 5);
    CIRC(tx, ty - 26, 50, '#F4EFE4', 0);
    g.fillStyle = 'rgba(0,0,0,.08)';
    g.beginPath(); g.ellipse(tx + 8, ty - 16, 38, 26, 0, 0, Math.PI * 2); g.fill();
    // steam
    g.strokeStyle = 'rgba(240,240,240,.3)'; g.lineWidth = 4; g.lineCap = 'round';
    for (let s = -1; s <= 1; s++) {
      g.beginPath();
      const sx = tx + s * 24, ph = o.t * 1.8 + s * 2;
      g.moveTo(sx, ty - 84);
      g.bezierCurveTo(sx + Math.sin(ph) * 11, ty - 120, sx - Math.sin(ph + 1) * 11, ty - 148, sx + Math.sin(ph + 2) * 9, ty - 178);
      g.stroke();
    }
    // dishes around: curry, greens, fish on banana leaf, chili
    // curry bowl (upper left)
    CIRC(tx - 150, ty - 90, 42, '#8A4A2E', 4);
    CIRC(tx - 150, ty - 90, 32, '#A85A34', 0);
    g.fillStyle = 'rgba(255,210,140,.25)';
    g.beginPath(); g.ellipse(tx - 158, ty - 98, 14, 8, -.4, 0, Math.PI * 2); g.fill();
    // greens plate (upper right)
    CIRC(tx + 155, ty - 85, 40, '#E8E0D0', 4);
    g.fillStyle = '#4A6A3A';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.ellipse(tx + 155 + Math.cos(i * 1.3) * 14, ty - 85 + Math.sin(i * 1.3) * 10, 12, 7, i, 0, Math.PI * 2);
      g.fill();
    }
    // fish on banana leaf (bottom left)
    g.fillStyle = '#3A5A2E';
    g.beginPath(); g.ellipse(tx - 140, ty + 110, 78, 42, .3, 0, Math.PI * 2); g.fill();
    g.lineWidth = 4; g.strokeStyle = OL; g.stroke();
    g.fillStyle = '#C9B891';
    g.beginPath(); g.ellipse(tx - 140, ty + 108, 52, 20, .3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(tx - 176, ty + 100); g.quadraticCurveTo(tx - 140, ty + 112, tx - 104, ty + 116); g.stroke();
    // chili plate (bottom right)
    CIRC(tx + 150, ty + 105, 34, '#E8E0D0', 4);
    g.fillStyle = '#B84430';
    for (let i = 0; i < 4; i++) {
      g.save();
      g.translate(tx + 150 + Math.cos(i * 1.7) * 12, ty + 105 + Math.sin(i * 1.7) * 9);
      g.rotate(i * .8);
      g.beginPath(); g.ellipse(0, 0, 11, 4.5, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    // small bowls rim
    CIRC(tx - 40, ty + 150, 26, '#C9A54E', 4);
    CIRC(tx + 45, ty + 155, 24, '#8A4A2E', 4);
    g.restore();
    // floating tokens on deliberate orbit (line 21)
    const p21 = rv(o, 21, 1.4);
    if (p21) {
      const fl = (x, y, d, draw) => {
        g.save();
        g.globalAlpha = p21;
        g.translate(x, y + Math.sin(o.t * 1.3 + d) * 9);
        draw();
        g.restore();
      };
      // rice sprig
      fl(200, 560, 0, () => {
        g.strokeStyle = '#C9A54E'; g.lineWidth = 3.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, 30); g.quadraticCurveTo(4, 0, 0, -22); g.stroke();
        g.fillStyle = '#E8DCC0';
        for (let i = 0; i < 5; i++) {
          g.beginPath(); g.ellipse(-6 + i * 3, -20 + i * 7, 4, 9, .5, 0, Math.PI * 2); g.fill();
        }
      });
      // folded woven cloth
      fl(880, 540, 2.2, () => {
        g.fillStyle = '#8F3F34';
        SHAPE([[-30, -16], [30, -16], [30, 16], [-30, 16]], '#8F3F34');
        g.strokeStyle = '#D6A03D'; g.lineWidth = 2.5;
        [-8, 0, 8].forEach(yy => {
          g.beginPath(); g.moveTo(-28, yy); g.lineTo(28, yy); g.stroke();
        });
      });
      // manuscript seal with thai letter
      fl(540, 470, 4.1, () => {
        CIRC(0, 0, 30, '#B84430', 4);
        TXTW('ก', 0, 12, 40, '#F2E8D5', 'center', 800);
      });
      // small boat token
      fl(320, 420, 5.6, () => {
        g.fillStyle = '#5A4630';
        g.beginPath();
        g.moveTo(-34, -4); g.quadraticCurveTo(0, 12, 34, -4);
        g.quadraticCurveTo(0, 4, -34, -4);
        g.closePath(); g.fill();
        g.lineWidth = 3; g.strokeStyle = OL; g.stroke();
      });
      fl(760, 420, 1.2, () => {
        // water jar token
        g.fillStyle = '#6A5238';
        g.beginPath();
        g.moveTo(-14, -20); g.quadraticCurveTo(-22, 0, -14, 18);
        g.quadraticCurveTo(0, 26, 14, 18);
        g.quadraticCurveTo(22, 0, 14, -20);
        g.closePath(); g.fill();
        g.lineWidth = 3; g.strokeStyle = OL; g.stroke();
        g.fillRect(-8, -26, 16, 8);
      });
    }
  });
  captionScrim(.4);
  screenVig(.32);
  grainLayer();
  // closing title — soft glow, gold gradient, no heavy stroke
  const p22 = rv(o, 22, 1.5);
  if (p22) {
    const e = ease(p22);
    g.save();
    g.globalAlpha = e;
    const gg = g.createLinearGradient(0, 330, 0, 420);
    gg.addColorStop(0, '#FFE1A0');
    gg.addColorStop(1, '#E0A84C');
    g.font = `900 76px ${FONT}`;
    g.textAlign = 'center';
    g.shadowColor = 'rgba(255,190,90,.5)';
    g.shadowBlur = 26;
    g.fillStyle = gg;
    g.fillText('เราเกิดจากใครบ้าง', 540, 400);
    const e2 = clamp01((p22 - .35) / .65);
    if (e2) {
      g.globalAlpha = e2;
      g.shadowBlur = 10;
      g.font = `700 38px ${FONT}`;
      g.fillStyle = '#E8DED5';
      g.fillText('มากกว่าเรามาจากไหน', 540, 468);
      // ornament line
      g.strokeStyle = 'rgba(240,190,97,.6)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(400, 440); g.lineTo(680, 440); g.stroke();
    }
    g.restore();
  }
}

// ── Scene table ───────────────────────────────────────────
const SC = [
  [2, scHook],          // 0–1   myth arrow + impact X
  [6, scLandBefore],    // 2–5   cinematic map: the land before
  [9, scMerchant],      // 6–8   merchant in canal city at dusk
  [15, scStreams],      // 9–14  migration flows + mixing
  [17, scSukhothai],    // 15–16 gathering network
  [21, scAyutthaya],    // 17–20 port + parchment inset
  [Infinity, scClosing],// 21–22 shared table + question
];
