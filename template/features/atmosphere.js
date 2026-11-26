/**
 * features/atmosphere.js — cinematic atmosphere & nature library (optional module)
 * ------------------------------------------------------------------
 * Extracted from the real production of `thai-origins` (examples/legacy/thai-origins/).
 * These helpers upgrade scenes from "flat stickers on a gradient" to cinematic
 * frames: multi-stop skies, atmospheric depth, living water, vegetation,
 * weather, and film-grain frame treatments.
 *
 * LOAD ORDER: after core/ runtime files, before story/style.js — it uses core globals (g, W, H, CIRC, lerp).
 * Everything is deterministic: animation derives from time `t` and seeded randomness
 * (`srnd`), never Math.random(), so frames are reproducible and chunk-parallel-safe.
 *
 * QUICK RECIPES
 * -------------
 * Dusk settlement backdrop:
 *   skyStops([[0,'#151B2F'],[.42,'#342D45'],[.68,'#87513C'],[.82,'#D99154']], 0, 1240);
 *   cloudsDusk([[230,420,320],[780,540,380]], o.t);
 *   birdsFlock(520, 540, 5, o.t, 11);
 *   hillsLayer(1162, 130, 3, mixHex('#2A1E16','#87513C',.72));   // far hills, hazed
 *   hillsLayer(1176,  78, 7, mixHex('#20160F','#87513C',.5));    // near hills, darker
 *   // ... buildings / characters ...
 *   waterBody(1244, '#243846', '#0B1720');
 *   lightReflection(700, 1244, '255,180,100', o.t, .2);
 *   ripples(1256, 1620, o.t, 5);
 *   captionScrim(.5); screenVig(.3); grainLayer();   // always last, in this order
 *
 * KEY PRINCIPLE (learned the hard way in production):
 *   Depth comes from COLOR MIXING toward the sky/horizon color (mixHex), never from
 *   lowering alpha — alpha-faded objects read as ghosts, color-mixed objects read as distance.
 */

// NOTE: this module deliberately declares NOTHING at global lexical scope — everything is
// wrapped in an IIFE and exported explicitly. Scene code uses the names bare
// (skyStops(...), waterBody(...)) because globalThis/window properties resolve globally.
// Copied legacy `const` helpers can shadow those names inside story/style.js, so remove
// duplicate declarations unless an override is intentional.

(() => {
// ── Seeded randomness (deterministic, no flicker) ─────────

// ── Color helpers ─────────────────────────────────────────
// mix hex color a toward b by p (0..1) — the atmospheric-perspective workhorse
// hex + alpha → rgba string (passes through non-hex colors unchanged)

// ── Sky / atmosphere / frame treatments ───────────────────
// multi-stop vertical sky gradient, bleeds beyond camera bounds
function skyStops(stops, y0 = 0, y1 = H) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([p, c]) => gr.addColorStop(p, c));
  g.fillStyle = gr;
  g.fillRect(-400, -400, W + 800, H + 800);
}
// soft horizontal atmosphere band (horizon glow, heat haze) — color as 'r,g,b'
function hazeBand(y, h, color, a) {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, `rgba(${color},0)`);
  gr.addColorStop(.5, `rgba(${color},${a})`);
  gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr;
  g.fillRect(-400, y, W + 800, h);
}
// twinkling stars, seeded positions, sine-phase twinkle; yMax = lowest star band
function starField(n, seed, yMax, t) {
  for (let i = 0; i < n; i++) {
    const x = srnd(seed + i * 2) * 1200 - 60, y = 40 + srnd(seed + i * 2 + 1) * yMax;
    const tw = .5 + .5 * Math.sin(t * (1 + srnd(i) * 2) + i * 2.4);
    const r = .8 + srnd(seed + i * 3) * 1.6;
    CIRC(x, y, r, `rgba(232,240,223,${.2 + .55 * tw})`, 0);
  }
}
// procedural film grain: built once in an offscreen tile, overlaid per frame
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
// screen-space vignette — draw OUTSIDE cam() so it never moves with the camera
function screenVig(strength = .3, fy = .52) {
  const v = g.createRadialGradient(W / 2, H * fy, H * .3, W / 2, H * fy, H * .78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,${strength})`);
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
}
// gradient scrim behind the subtitle zone — draw INSIDE the scene, below captions
function captionScrim(a = .5) {
  const gr = g.createLinearGradient(0, 1180, 0, 1560);
  gr.addColorStop(0, 'rgba(4,6,10,0)');
  gr.addColorStop(.5, `rgba(4,6,10,${a * .7})`);
  gr.addColorStop(1, `rgba(4,6,10,${a})`);
  g.fillStyle = gr;
  g.fillRect(0, 1180, W, 740);
}
// radial glow anchored to a real light source — col as 'r,g,b'
function focusGlow(x, y, r, col, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${col},${a})`);
  gr.addColorStop(.5, `rgba(${col},${a * .4})`);
  gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

// ── Typography helpers ────────────────────────────────────
// text with soft shadow (no heavy stroke/pill — gentler than core TXT at large sizes)
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
// small label on a dark plate with optional accent bar — map cities, annotations
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

// ── Landscape layers ──────────────────────────────────────
// rolling hill silhouette layer — pre-mix col toward the sky for atmospheric depth
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
// canopy mass cluster — dark backlit vegetation to fill gaps between buildings
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
// dusk cloud wisps — wide overlapping flat ellipses, slow drift
// (single discs + bright rims read as UFOs — keep them flat, wide, and overlapping)
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
// distant bird flock — small flapping chevrons drifting slowly
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

// ── Water system ──────────────────────────────────────────
// base vertical gradient body, then layer ripples/reflections on top
function waterBody(y0, c0, c1) {
  const gr = g.createLinearGradient(0, y0, 0, H + 200);
  gr.addColorStop(0, c0);
  gr.addColorStop(1, c1);
  g.fillStyle = gr;
  g.fillRect(-200, y0, W + 400, H + 200 - y0);
}
// curved broken ripples — longer and brighter toward the viewer, gentle sine drift
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
      const bx = srnd(seed + i * 7 + j * 13) * W;
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
// flickering vertical light reflection under a window/boat/sun — additive
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

// ── Particles ─────────────────────────────────────────────
// fireflies / dust motes drifting in a band — additive, seeded, twinkling
function motes(n, y0, y1, t, seed, col = '255,200,120') {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const bx = srnd(seed + i * 3) * W;
    const by = y0 + srnd(seed + i * 3 + 1) * (y1 - y0);
    const x = bx + Math.sin(t * .4 + i * 1.7) * 24;
    const y = by + Math.cos(t * .3 + i * 2.1) * 16;
    const tw = .3 + .7 * Math.abs(Math.sin(t * (0.8 + srnd(i)) + i * 2));
    CIRC(x, y, 1.6 + srnd(seed + i) * 1.4, `rgba(${col},${.35 * tw})`, 0);
  }
  g.restore();
}
// slow smoke column (cooking fire, incense) — looping rise, wind shear
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

Object.assign(globalThis, {
  skyStops, hazeBand, starField, grainLayer, screenVig, captionScrim, focusGlow,
  TXTW, labelPlate,
  hillsLayer, treeMass, cloudsDusk, birdsFlock,
  waterBody, ripples, lightReflection,
  motes, smokeColumn,
});
})();
