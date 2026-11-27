/**
 * @file tests/unit/globe.test.mjs — dot-matrix globe: lattice uniformity, landmask orientation, rotation/projection math, face conversion.
 * The drawing functions are exercised against a recording stub context; the pure helpers carry the logic.
 * Run: node --test tests/unit/globe.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../helpers/load-script.mjs';

const env = loadScripts(['core/base.js', 'core/motion.js', 'features/globe.js'],
  ['dotGlobe', 'globeArc', 'globeMark', 'globeLattice', 'globeLand', 'globeLL', 'globeRot', 'globeAngles', 'globeProject']);
const { globeLattice, globeLand, globeLL, globeRot, globeAngles, globeProject } = env;

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── lattice ───────────────────────────────────────────────

test('globeLattice returns n unit-sphere points', () => {
  const { pts, land } = globeLattice(500);
  assert.equal(pts.length, 500 * 3);
  assert.equal(land.length, 500);
  for (let i = 0; i < 500; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
    assert.ok(near(x * x + y * y + z * z, 1, 1e-6), `point ${i} off unit sphere: ${x * x + y * y + z * z}`);
  }
});

test('globeLattice is deterministic — same n, same points and land flags', () => {
  const a = globeLattice(300), b = globeLattice(300);
  assert.deepEqual([...a.pts], [...b.pts]);
  assert.deepEqual([...a.land], [...b.land]);
});

test('globeLattice spreads evenly — no hemisphere is starved', () => {
  const { pts } = globeLattice(1000);
  let north = 0, south = 0, east = 0, west = 0;
  for (let i = 0; i < 1000; i++) {
    if (pts[i * 3 + 1] > 0) north++; else south++;
    if (pts[i * 3] > 0) east++; else west++;
  }
  assert.ok(Math.abs(north - south) < 80, `north ${north} south ${south}`);
  assert.ok(Math.abs(east - west) < 80, `east ${east} west ${west}`);
});

test('globeLattice land flags contain both land and ocean', () => {
  const { land } = globeLattice(2000);
  const n = [...land].reduce((s, v) => s + v, 0);
  const frac = n / land.length;
  assert.ok(frac > 0.1 && frac < 0.7, `land fraction ${frac} — mask lookup looks broken`);
});

// ── landmask orientation (verified against real geography) ──

test('globeLand matches known geography', () => {
  const LAND = [[13.75, 100.5, 'Bangkok'], [23, 15, 'Sahara'], [-5, -60, 'Amazon'], [51.5, -0.12, 'London'], [-33.8, 151.2, 'Sydney'], [40.7, -74, 'New York']];
  const WATER = [[0, -150, 'mid-Pacific'], [30, -65, 'Sargasso Sea'], [-55, 0, 'Southern Ocean'], [0, 140, 'west Pacific'], [-20, 175, 'south Pacific']];
  for (const [la, lo, name] of LAND) assert.equal(globeLand(la, lo), 1, `${name} must be land`);
  for (const [la, lo, name] of WATER) assert.equal(globeLand(la, lo), 0, `${name} must be water`);
});

// ── latLonTo3D pins (cobe convention) ─────────────────────

const round9 = v => Math.round(v * 1e9) / 1e9 + 0;
test('globeLL pins: equator-prime-meridian at +x, north pole at +y', () => {
  assert.deepEqual(globeLL([0, 0]).map(round9), [1, 0, 0]);
  assert.deepEqual(globeLL([90, 0]).map(round9), [0, 1, 0]);
  assert.deepEqual(globeLL([-90, 0]).map(round9), [0, -1, 0]);
  const e = globeLL([0, 90]);
  assert.ok(near(e[0], 0, 1e-9) && near(e[2], -1, 1e-9), `lon+90 must sit at -z, got ${e}`);
});

// ── rotation ──────────────────────────────────────────────

test('globeRot identity at phi=0 theta=0', () => {
  const [x, y, z] = globeRot(0.3, -0.5, 0.8, 0, 0);
  assert.ok(near(x, 0.3) && near(y, -0.5) && near(z, 0.8));
});

test('globeRot preserves vector length', () => {
  const cases = [[1, 0, 0, 1.2, 0.4], [0, 1, 0, -0.7, 0.9], [0.5, 0.5, 0.707, 2.4, -1.1]];
  for (const [x, y, z, phi, theta] of cases) {
    const [rx, ry, rz] = globeRot(x, y, z, phi, theta);
    assert.ok(near(rx * rx + ry * ry + rz * rz, x * x + y * y + z * z, 1e-9), `len drift at phi=${phi} theta=${theta}`);
  }
});

// ── face conversion ───────────────────────────────────────

test('globeAngles face conversion puts the faced point dead centre front', () => {
  for (const face of [[13.7, 100.5], [0, 0], [51.5, -0.12], [-33.8, 151.2], [40.7, -74]]) {
    const { phi0, theta } = globeAngles({ face });
    const p = globeLL(face);
    const [rx, ry, rz] = globeRot(p[0], p[1], p[2], phi0, theta);
    assert.ok(near(rx, 0, 1e-6) && near(ry, 0, 1e-6) && near(rz, 1, 1e-6), `face ${face}: rotated to (${rx},${ry},${rz})`);
  }
});

test('globeAngles passes through explicit phi0/theta and defaults', () => {
  assert.deepEqual(globeAngles({ phi0: 1.2, theta: 0.35 }), { phi0: 1.2, theta: 0.35 });
  assert.deepEqual(globeAngles({}), { phi0: 0, theta: 0 });
});

// ── projection ────────────────────────────────────────────

test('globeProject centres the faced point and culls its antipode', () => {
  const G = { cx: 540, cy: 720, r: 380, spin: 0, face: [13.7, 100.5] };
  const front = globeProject(G, 0, [13.7, 100.5]);
  assert.ok(near(front.x, 540, 0.5) && near(front.y, 720, 0.5), `faced point must project to spec centre, got ${front.x},${front.y}`);
  assert.equal(front.vis, true);
  const back = globeProject(G, 0, [-13.7, 100.5 - 180]);
  assert.equal(back.vis, false, 'antipode must be hidden behind the globe');
});

test('globeProject spins with t — a fixed point drifts horizontally', () => {
  const G = { cx: 540, cy: 720, r: 380, spin: 0.5, face: [13.7, 100.5] };
  const a = globeProject(G, 0, [13.7, 100.5]);
  const b = globeProject(G, 1, [13.7, 100.5]);
  assert.ok(Math.abs(a.x - b.x) > 30, `spin must move the projection: ${a.x} -> ${b.x}`);
});

test('globeProject is deterministic — identical inputs, identical output', () => {
  const G = { cx: 540, cy: 720, r: 380, spin: 0.2, face: [13.7, 100.5] };
  assert.deepEqual(globeProject(G, 2.5, [37.77, -122.42]), globeProject(G, 2.5, [37.77, -122.42]));
});

// ── drawing surface (stub context) ────────────────────────

const stubCtx = ops => new Proxy({}, {
  get: (t, k) => {
    if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop: () => {} });
    return (...a) => ops.push(k);
  },
  set: () => true,
});

test('dotGlobe draws without throwing and emits fill ops for visible dots', () => {
  const ops = [];
  globalThis.g = stubCtx(ops);
  const G = { cx: 540, cy: 720, r: 380, spin: 0.2, face: [13.7, 100.5] };
  assert.doesNotThrow(() => env.dotGlobe(G, 1.5, { land: '#d8c9a3', ocean: 0.12 }));
  const arcs = ops.filter(o => o === 'arc').length;
  assert.ok(arcs > 500, `expected hundreds of dot arcs, got ${arcs}`);
  assert.ok(ops.includes('fill'), 'dots must be filled');
});

test('dotGlobe dot count scales with r squared (constant spacing, no dense shimmer)', () => {
  const count = r => {
    const ops = [];
    globalThis.g = stubCtx(ops);
    env.dotGlobe({ cx: 540, cy: 720, r, spin: 0, face: [0, 0] }, 0, { land: '#d8c9a3', ocean: 0 });
    return ops.filter(o => o === 'arc').length;
  };
  const small = count(150), big = count(300);
  const ratio = big / small;
  assert.ok(ratio > 2.5 && ratio < 6, `doubling r should ~4x the dots, got ${ratio}x (${small} -> ${big})`);
});

test('globeArc and globeMark draw without throwing', () => {
  const ops = [];
  globalThis.g = stubCtx(ops);
  const G = { cx: 540, cy: 720, r: 380, spin: 0, face: [13.7, 100.5] };
  assert.doesNotThrow(() => env.globeArc(G, 1, [13.75, 100.5], [37.77, -122.42], 1, { color: '#e05252' }));
  assert.doesNotThrow(() => env.globeMark(G, 1, [37.77, -122.42], 1, { color: '#ffd166' }));
  assert.ok(ops.includes('stroke') || ops.includes('fill'), 'arc/marker must reach the canvas');
});

test('globeArc reveals progressively with p', () => {
  const segs = p => {
    const ops = [];
    globalThis.g = stubCtx(ops);
    env.globeArc({ cx: 540, cy: 720, r: 380, spin: 0, face: [13.7, 100.5] }, 0, [13.75, 100.5], [37.77, -122.42], p, {});
    return ops.filter(o => o === 'lineTo').length;
  };
  assert.ok(segs(1) > segs(0.4), `reveal p must extend the arc (${segs(0.4)} vs ${segs(1)})`);
  assert.equal(segs(0), 0, 'p=0 must draw nothing');
});

test('globeMark hides the antipode marker', () => {
  const ops = [];
  globalThis.g = stubCtx(ops);
  const G = { cx: 540, cy: 720, r: 380, spin: 0, face: [13.7, 100.5] };
  env.globeMark(G, 0, [-13.7, 100.5 - 180], 1, {});
  assert.equal(ops.filter(o => o === 'arc').length, 0, 'back-facing marker must not draw');
});
