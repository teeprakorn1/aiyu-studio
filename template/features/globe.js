/**
 * features/globe.js — dot-matrix globe (optional module)
 * ------------------------------------------------------------------
 * A rotating Earth made of dots on a fibonacci lattice — land dots bright, ocean dots
 * faint — with great-circle arcs and markers pinned to real lat/lon coordinates.
 * Technique adapted from cobe (MIT, shuding/cobe): fibonacci sphere lattice, 1-bit
 * equirectangular landmask, quadratic-bezier arc lift, rim-darkened shading.
 * Reimplemented for Canvas 2D; nothing is copied verbatim. See docs/acknowledgements.md.
 *
 * LOAD ORDER: after core/ runtime files, before story/style.js — it uses core globals (g, mixHex, hexA).
 * Everything is deterministic: rotation derives from t, the lattice and landmask are
 * precomputed once and cached, so parallel chunk rendering is bit-identical.
 *
 * QUICK RECIPES
 * -------------
 * Globe facing Bangkok, slow spin:
 *   const GLOBE = { cx: 540, cy: 760, r: 380, spin: .15, face: [13.7, 100.5] };
 *   dotGlobe(GLOBE, o.t, { land: '#d8c9a3', ocean: .12, glow: '210,190,140', shade: 1.2 });
 *   globeArc(GLOBE, o.t, [13.75, 100.5], [37.77, -122.42], rv(o, 5), { color: '#e05252' });
 *   globeMark(GLOBE, o.t, [37.77, -122.42], rv(o, 6), { color: '#ffd166' });
 *
 * spec fields: cx, cy, r (px), spin (rad/s), phi0/theta (rad), or face:[lat,lon] instead of phi0/theta.
 * Dots scale with r (constant ~15px spacing); pass opts.dots to override the count.
 */

// NOTE: like atmosphere.js this module is fully IIFE-wrapped; nothing is declared at
// global lexical scope. Pure helpers are exported for unit tests and are marked internal
// in the docs — the author-facing API is dotGlobe, globeArc, globeMark.

(() => {

// ── Landmask: 1-bit 256x128 equirectangular mask, baked from cobe's texture.png ──
// Decode lazily once; 4096 bytes = 32768 pixels, MSB first per row.
const LAND_B64 = '////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////Dj///////6n////////////////////////////////8AAACAAAAgP8AP////////////////////////////8AAAP/gAAAAAAA+gf//////////////////////////wAAAfQAAAAAAAADg////////////////////g//////AAAAQAAAAGYAAAf8H//////////////////4AJ////8AAAAAAAAD4AAP//4AAfn/////////x/////4AB////wAAAAAAAAcAAL///gKAef////////+H/////8zD///+AAAAAAAAHAHH/////8A/AAO//P/+AAM//////+H///wAAAAAIAAcA//////////uAA/gP//z/5//////4f//+AAAAB/8AAB73//////////9/+D////////////w///gAAAAf//mf//f////////////+H////////////D//gAAAAD///f////////////////5////////////4P/4A/AAA/3+P////////////////CAf///////+8T/Af8AD8AAH+f/////////////////4AP////////ghTwA/gAAAAB/n//////////////////wA////////8APwAB8AAAAAP+f///////////////z/gAB/sX/////gA/mAAwAAAAA/4///////////////8OAAABeAD/////AD/8AAAAAAMBPB/////////////+ABwAAABkAH/////gH/wAAAAAAwDcf/////////////gAfAAAAQAAH/////wf/gAAAAADgPB/////////////4AB4AAAAAAAH/////3//wAAAAB3A///////////////8AHAAAAAAAAP/////P//gAAAAHeP///////////////8AYAAAAAAAAf///////8AAAAAB7////////////////wBAAAAAAAAA///////+YAAAAABf///////////////9gAAAAAAAAAB////v//DwAAAAAf/////5//////////0AAAAAAAAAAD///+P/8HAAAAAA/////+B/////////+QAAAAAAAAAAP////v/+AAAAAAB///9nwHf////////wAAAAAAAAAAB////2/9gAAAAAAH/v/ifj9////////+OAAAAAAAAAAH//////AAAAAAAP8nP8AfH/////////w4AAAAAAAAAAf/////8AAAAAAB/wnP3x+P////////4AAAAAAAAAAAA//////AAAAAAAH+CG7//4/////////AYAAAAAAAAAAD/////4AAAAAAAfwARn//j///////wYBgAAAAAAAAAAH/////AAAAAAAA+AmGf//P///////4wMAAAAAAAAAAAP////8AAAAAAAAj/AAF//////////DHwAAAAAAAAAAA/////gAAAAAAAH/8AAH/////////4J8AAAAAAAAAAAA////8AAAAAAAA//8GAf/////////wOAAAAAAAAAAAAB////AAAAAAAAH//8/L//////////gQAAAAAAAAAAAAG//+8AAAAAAAAf//////////////+AAAAAAAAAAAAAAP/8AYAAAAAAAD//////+////////4AAAAAAAAAAAAAAX/gBgAAAAAAA/////9/5////////AAAAAAAAAAAAAAAv+ACAAAAAAAD/////7/wf//////4AAAAAAAAAAAAAADf4AAAAAAAAAf/////v/uB//////IAAAAAAAAAAAAAAE/gBgAAAAAAD//////f/8B/////5gAAAAAAAAAAAAAAB+ADwAAAAAAP/////8//wH//f/+AAAAAAAAAAAAAAAAH4MBgAAAAAA//////7//AH/w/8gAAAAAAAAAAAAAAAAfxwA4AAAAAD//////n/4AP+B/mAAAAAAAAAAAAAAAAAf+ABAAAAAAP//////P/AA/gH/AGAAAAAAAAAAAAAAAAP4AAAAAAAA//////8/wAD8AX+AYAAAAAAAAAAAAAAAAD+AAAAAAAD//////78AAPgAf8BgAAAAAAAAAAAAAAAAD4AAAAAAAP///////AAAeAA/wDAAAAAAAAAAAAAAAAADgAAAAAAA///////gAAB4ACfADAAAAAAAAAAAAAAAAAGD+wAAAAB///////+AADgAI4AQAAAAAAAAAAAAAAAAAP//gAAAAD///////wAANAAhABQAAAAAAAAAAAAAAAAAb//AAAAAH///////AAAMADAAHAAAAAAAAAAAAAAAAAAH//AAAAAP//////4AAAwAGAMMAAAAAAAAAAAAAAAAAAf//gAAAAOw/////gAAAADcB4AAAAAAAAAAAAAAAAAAB///AAAAAAAf///8AAAAAOwPAAAAAAAAAAAAAAAAAAAP//8AAAAAAB////gAAAAAfB8AAAAAAAAAAAAAAAAAAB///4AAAAAAP///4AAAAAA8fzoAAAAAAAAAAAAAAAAAP///4AAAAAA//+/AAAAAABx/MGAAAAAAAAAAAAAAAAA////4AAAAAD//78AAAAAADz7gNgAAAAAAAAAAAAAAAB////+AAAAAH///gAAAAAAPHuO/4AAAAAAAAAAAAAAAP////8AAAAAP//8AAAAAAAYAcA/wAAAAAAAAAAAAAAAf////4AAAAAf//wAAAAAAAcAAA/sAAAAAAAAAAAAAAB/////gAAAAB///AAAAAAAA+AAD+AAAAAAAAAAAAAAAD////+AAAAAH//8AAAAAAAAADADMAAAAAAAAAAAAAAAP////wAAAAAP//4AAAAAAAAAAAAYAAAAAAAAAAAAAAAf///+AAAAAA///gAAAAAAAAAA4QAAAAAAAAAAAAAAAA////4AAAAAH//+DAAAAAAAAAPjAAAAAAAAAAAAAAAAD////gAAAAA///4cAAAAAAAAH+GAAAAAAAAAAAAAAAAH///8AAAAAD///jwAAAAAAAA/88AAAAAAAAAAAAAAAAH///wAAAAAP//4fAAAAAAAAH//wAAAgAAAAAAAAAAAAP///AAAAAAf//B4AAAAAAAA///gAAAAAAAAAAAAAAAA///4AAAAAB//4HgAAAAAAAf///AAAAAAAAAAAAAAAAD///gAAAAAD//gcAAAAAAAD///+AEAAAAAAAAAAAAAAP//8AAAAAAP//BwAAAAAAAf///8AAAAAAAAAAAAAAAA//+AAAAAAA//4HAAAAAAAB////wAAAAAAAAAAAAAAAH//wAAAAAAD//AAAAAAAAAH////gAAAAAAAAAAAAAAAf//AAAAAAAH/4AAAAAAAAAf///+AAAAAAAAAAAAAAAB//4AAAAAAAf/gAAAAAAAAB////4AAAAAAAAAAAAAAAH//AAAAAAAA/8AAAAAAAAAD////gAAAAAAAAAAAAAAAf/4AAAAAAAB/gAAAAAAAAAP///+AAAAAAAAAAAAAAAB//gAAAAAAAH8AAAAAAAAAA/gf/wAAAAAAAAAAAAAAAP/8AAAAAAAAdAAAAAAAAAADgAv/AAAAAAAAAAAAAAAA//AAAAAAAAAAAAAAAAAAAAAAAf4AAQAAAAAAAAAAAAD/8AAAAAAAAAAAAAAAAAAAAAAB/gAAgAAAAAAAAAAAAP/AAAAAAAAAAAAAAAAAAAAAAAB4AADgAAAAAAAAAAAB/wAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAH+AAAAAAAAAAAAAAAAAAAAAAAAHAADAAAAAAAAAAAAAfwAAAAAAAAAAAAAAAAAAAAAAAAYAAcAAAAAAAAAAAAA/AAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAHwAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAfgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAAAAAAAAAHwAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAAAg/gGB8AAAAAAAAAAAAAAAAAAfgAAAAAAAAAAAAfwAD///////8AAAAAAAAAAAAAAAAB/AAAAAAAAAAAA///8f////////4AAAAAAAAAAAAAAD/4AAAAAAAAPAf///////////////AAAAAAAAAAAAAAP/gAAAAA/////////////////////8AAAAAAAAAD/4D//AAAAA//////////////////////8AAAAABv/3P////4AAAAP//////////////////////wAAAA//////////4AAAH//////////////////////wAAAB///////////+AAH//////////////////////+AMA//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////w==';
let _landBytes = null;
function landBytes() {
  if (_landBytes) return _landBytes;
  const bin = atob(LAND_B64);
  _landBytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) _landBytes[i] = bin.charCodeAt(i);
  return _landBytes;
}

// ── Pure geometry (exported for tests; internal use) ─────

/**
 * lat/lon in degrees to a unit-sphere point. y is north, lon 0 faces +x (cobe convention).
 * @param {[number, number]} latlon - [latitude, longitude] in degrees
 * @returns {[number, number, number]} unit vector [x, y, z]
 */
function globeLL(latlon) {
  const lat = latlon[0] * Math.PI / 180, lon = latlon[1] * Math.PI / 180 - Math.PI;
  const c = Math.cos(lat);
  return [-c * Math.cos(lon), Math.sin(lat), c * Math.sin(lon)];
}

/**
 * Rotate a point by the globe orientation (phi around y, then theta around x — cobe order).
 * @param {number} x - point x on unit sphere
 * @param {number} y - point y on unit sphere
 * @param {number} z - point z on unit sphere
 * @param {number} phi - yaw in radians
 * @param {number} theta - tilt in radians
 * @returns {[number, number, number]} rotated [x, y, z]; z >= 0 faces the viewer
 */
function globeRot(x, y, z, phi, theta) {
  const cx = Math.cos(theta), sx = Math.sin(theta), cy = Math.cos(phi), sy = Math.sin(phi);
  return [
    cy * x + sy * z,
    sy * sx * x + cx * y - cy * sx * z,
    -sy * cx * x + sx * y + cy * cx * z,
  ];
}

/**
 * Resolve spec to base angles. face:[lat,lon] wins over phi0/theta and aims that point at the camera at t=0.
 * @param {object} spec - globe spec ({cx, cy, r, spin, phi0, theta} or {face:[lat,lon]})
 * @returns {{phi0: number, theta: number}} base angles in radians
 */
function globeAngles(spec) {
  if (Array.isArray(spec.face)) {
    const p = globeLL(spec.face);
    const theta = Math.asin(Math.max(-1, Math.min(1, p[1])));
    const phi0 = Math.abs(Math.cos(theta)) < 1e-9 ? 0 : Math.atan2(-p[0], p[2]);
    return { phi0, theta };
  }
  return { phi0: spec.phi0 || 0, theta: spec.theta || 0 };
}

/**
 * Sample the baked landmask. Returns 1 for land, 0 for water.
 * @param {number} lat - latitude in degrees, -90..90
 * @param {number} lon - longitude in degrees, any range (wrapped)
 * @returns {number} 1 land / 0 water
 */
function globeLand(lat, lon) {
  lon = ((lon % 360) + 540) % 360 - 180;
  lat = Math.max(-90, Math.min(90, lat));
  const x = Math.min(255, Math.max(0, Math.round((lon + 180) / 360 * 255)));
  const y = Math.min(127, Math.max(0, Math.round((90 - lat) / 180 * 127)));
  const b = landBytes();
  return (b[y * 32 + (x >> 3)] >> (7 - (x & 7))) & 1;
}

const _latCache = new Map();
/**
 * Fibonacci lattice of n points on the unit sphere + per-point land flags.
 * Cached per n — the lattice is a pure function of n and never changes.
 * @param {number} n - point count
 * @returns {{pts: Float64Array, land: Uint8Array}} flat xyz triples + land flags
 */
function globeLattice(n) {
  const key = Math.max(3, Math.round(n));
  let hit = _latCache.get(key);
  if (hit) return hit;
  const pts = new Float64Array(key * 3);
  const land = new Uint8Array(key);
  const GA = Math.PI * (3 - Math.sqrt(5));
  const bytes = landBytes();
  for (let i = 0; i < key; i++) {
    const yy = 1 - (2 * i + 1) / key;
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
    const a = i * GA;
    const x = rr * Math.cos(a), z = rr * Math.sin(a);
    pts[i * 3] = x; pts[i * 3 + 1] = yy; pts[i * 3 + 2] = z;
    // land flag in object space: lat = asin(y), lon from atan2 in the globeLL frame
    const lat = Math.asin(Math.max(-1, Math.min(1, yy))) * 180 / Math.PI;
    let lon = Math.atan2(z, -x) * 180 / Math.PI + 180;
    if (lon > 180) lon -= 360;
    if (lon < -180) lon += 360;
    const tx = Math.min(255, Math.max(0, Math.round((lon + 180) / 360 * 255)));
    const ty = Math.min(127, Math.max(0, Math.round((90 - lat) / 180 * 127)));
    land[i] = (bytes[ty * 32 + (tx >> 3)] >> (7 - (tx & 7))) & 1;
  }
  hit = { pts, land };
  _latCache.set(key, hit);
  if (_latCache.size > 8) _latCache.delete(_latCache.keys().next().value);
  return hit;
}

/**
 * Project a lat/lon to canvas px. vis=false means fully behind the globe.
 * @param {object} spec - globe spec ({cx, cy, r, spin, phi0/theta or face})
 * @param {number} t - timeline seconds
 * @param {[number, number]} latlon - [latitude, longitude] in degrees
 * @returns {{x: number, y: number, vis: boolean}} screen position and visibility
 */
function globeProject(spec, t, latlon) {
  const { phi0, theta } = globeAngles(spec);
  const phi = phi0 + (spec.spin || 0) * t;
  const p = globeLL(latlon);
  const [rx, ry, rz] = globeRot(p[0], p[1], p[2], phi, theta);
  return { x: spec.cx + rx * spec.r, y: spec.cy - ry * spec.r, vis: rz >= 0 };
}

// ── Drawing ───────────────────────────────────────────────

const _BRIGHT_BUCKETS = 24;
const _bucketPts = Array.from({ length: _BRIGHT_BUCKETS }, () => []);

function _hexRGB(name, hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) throw new TypeError(`${name} must be a #rrggbb color, got ${String(hex)}`);
  const v = parseInt(hex.slice(1), 16);
  return [v >> 16, (v >> 8) & 255, v & 255];
}

function _specAngles(spec, t) {
  const { phi0, theta } = globeAngles(spec);
  return [phi0 + (spec.spin || 0) * t, theta];
}

/**
 * Dot-matrix globe. spec: {cx, cy, r, spin, phi0, theta} or {face:[lat,lon]}; r in px, angles in rad, spin in rad/s.
 * opts: {land '#rrggbb', ocean 0..1 brightness, glow 'r,g,b' optional, shade pow, dots override}.
 * @param {object} spec - globe placement/rotation spec
 * @param {number} t - timeline seconds
 * @param {object} [opts] - {land, ocean, glow, shade, dots}
 * @returns {void}
 */
function dotGlobe(spec, t, opts = {}) {
  const r = spec.r || 0;
  if (!(r > 0)) throw new TypeError(`dotGlobe spec.r must be a positive px radius, got ${r}`);
  const landCol = _hexRGB('dotGlobe opts.land', opts.land || '#d8c9a3');
  const oceanA = Math.max(0, Math.min(1, opts.ocean === undefined ? 0.12 : opts.ocean));
  const shade = opts.shade === undefined ? 1.2 : opts.shade;
  const n = opts.dots || Math.min(16000, Math.max(600, Math.round(spec.r * spec.r / 14)));
  const { pts, land } = globeLattice(n);
  const [phi, theta] = _specAngles(spec, t);

  if (opts.glow) {
    const [gr, gg, gb] = opts.glow.split(',').map(Number);
    const ga = opts.glowA === undefined ? 0.28 : opts.glowA;
    const grad = g.createRadialGradient(spec.cx, spec.cy, r * 0.85, spec.cx, spec.cy, r * 1.3);
    grad.addColorStop(0, `rgba(${gr},${gg},${gb},0)`);
    grad.addColorStop(0.55, `rgba(${gr},${gg},${gb},${ga * 0.55})`);
    grad.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
    g.fillStyle = grad;
    g.fillRect(spec.cx - r * 1.3, spec.cy - r * 1.3, r * 2.6, r * 2.6);
  }

  const cx = Math.cos(theta), sx = Math.sin(theta), cy = Math.cos(phi), sy = Math.sin(phi);
  const dotR = Math.max(1.4, Math.min(4.5, Math.sqrt(4 * Math.PI / n) * r * 0.16));
  for (const b of _bucketPts) b.length = 0;

  for (let i = 0; i < n; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
    const rx = cy * x + sy * z;
    const ry = sy * sx * x + cx * y - cy * sx * z;
    const rz = -sy * cx * x + sx * y + cy * cx * z;
    if (rz <= 0) continue;
    const bright = Math.pow(rz, shade) * (land[i] ? 1 : oceanA);
    if (bright < 0.02) continue;
    const bk = Math.min(_BRIGHT_BUCKETS - 1, (bright * _BRIGHT_BUCKETS) | 0);
    _bucketPts[bk].push(spec.cx + rx * r, spec.cy - ry * r);
  }

  g.fillStyle = '';
  for (let bk = 0; bk < _BRIGHT_BUCKETS; bk++) {
    const arr = _bucketPts[bk];
    if (!arr.length) continue;
    const a = ((bk + 0.5) / _BRIGHT_BUCKETS).toFixed(3);
    g.fillStyle = `rgba(${landCol[0]},${landCol[1]},${landCol[2]},${a})`;
    g.beginPath();
    for (let i = 0; i < arr.length; i += 2) {
      g.moveTo(arr[i] + dotR, arr[i + 1]);
      g.arc(arr[i], arr[i + 1], dotR, 0, 6.283185307179586);
    }
    g.fill();
  }
}

/**
 * Great-circle arc between two lat/lon points, lifted off the surface as a quadratic bezier.
 * Reveals progressively with p (0..1). Draws only the front-facing / off-silhouette parts.
 * @param {object} spec - globe spec (same as dotGlobe)
 * @param {number} t - timeline seconds
 * @param {[number, number]} from - [lat, lon] start
 * @param {[number, number]} to - [lat, lon] end
 * @param {number} p - reveal progress 0..1
 * @param {object} [opts] - {color '#rrggbb', height 0..1 of r, width px}
 * @returns {void}
 */
function globeArc(spec, t, from, to, p, opts = {}) {
  const prog = Math.max(0, Math.min(1, p));
  if (prog <= 0 || !(spec.r > 0)) return;
  const a = globeLL(from), b = globeLL(to);
  const mx = a[0] + b[0], my = a[1] + b[1], mz = a[2] + b[2];
  const ml = Math.sqrt(mx * mx + my * my + mz * mz);
  if (ml < 1e-6) return; // antipodal endpoints have no unique great circle
  const lift = 1 + (opts.height === undefined ? 0.32 : opts.height);
  const cx3 = mx / ml * lift, cy3 = my / ml * lift, cz3 = mz / ml * lift;
  const col = _hexRGB('globeArc opts.color', opts.color || '#e05252');
  const width = opts.width === undefined ? 3 : opts.width;
  const [phi, theta] = _specAngles(spec, t);
  const cth = Math.cos(theta), sth = Math.sin(theta), cph = Math.cos(phi), sph = Math.sin(phi);
  const SEG = 40, upto = Math.max(1, Math.ceil(prog * SEG));

  let prev = null;
  g.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.9)`;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i <= upto; i++) {
    const u = i / SEG;
    const w = (1 - u) * (1 - u), v = 2 * u * (1 - u), q = u * u;
    const x = w * a[0] + v * cx3 + q * b[0];
    const y = w * a[1] + v * cy3 + q * b[1];
    const z = w * a[2] + v * cz3 + q * b[2];
    const rx = cph * x + sph * z;
    const ry = sph * sth * x + cth * y - cph * sth * z;
    const rz = -sph * cth * x + sth * y + cph * cth * z;
    const vis = rz >= 0 || rx * rx + ry * ry >= 0.92; // front hemisphere or off the silhouette
    const sx = spec.cx + rx * spec.r, sy = spec.cy - ry * spec.r;
    if (vis && prev) {
      g.beginPath();
      g.moveTo(prev[0], prev[1]);
      g.lineTo(sx, sy);
      g.stroke();
    }
    prev = vis ? [sx, sy] : null;
  }
}

/**
 * Marker dot + pulse ring pinned to a lat/lon. Hidden when the point is behind the globe.
 * @param {object} spec - globe spec (same as dotGlobe)
 * @param {number} t - timeline seconds
 * @param {[number, number]} latlon - [lat, lon] in degrees
 * @param {number} p - reveal progress 0..1
 * @param {object} [opts] - {color '#rrggbb', size px, elev 0..1 of r}
 * @returns {void}
 */
function globeMark(spec, t, latlon, p, opts = {}) {
  const prog = Math.max(0, Math.min(1, p));
  if (prog <= 0 || !(spec.r > 0)) return;
  const col = _hexRGB('globeMark opts.color', opts.color || '#ffd166');
  const size = opts.size === undefined ? 6 : opts.size;
  const elev = opts.elev === undefined ? 0.02 : opts.elev;
  const p0 = globeLL(latlon);
  const [phi, theta] = _specAngles(spec, t);
  const k = 1 + elev;
  const [rx, ry, rz] = globeRot(p0[0] * k, p0[1] * k, p0[2] * k, phi, theta);
  if (rz < 0 && rx * rx + ry * ry < 0.92) return; // behind the disc
  const x = spec.cx + rx * spec.r, y = spec.cy - ry * spec.r;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  g.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${(0.55 * prog * (1 - pulse * 0.5)).toFixed(3)})`;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(x, y, size * (1.4 + pulse * 0.8), 0, 6.283185307179586);
  g.stroke();
  g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${prog.toFixed(3)})`;
  g.beginPath();
  g.arc(x, y, size * prog, 0, 6.283185307179586);
  g.fill();
}

Object.assign(globalThis, {
  dotGlobe, globeArc, globeMark,
  globeLattice, globeLand, globeLL, globeRot, globeAngles, globeProject,
});
})();
