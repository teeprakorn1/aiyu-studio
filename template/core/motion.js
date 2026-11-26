/**
 * @file core/motion.js — deterministic motion curves — ease family, springy physics, and the rv() reveal helper.
 * Part of the aiyu template runtime. Layer rules: core ← features ← story.
 */

(() => {

const ease = p => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);

/* Motion curves — deterministic pure functions of progress p (0..1), safe for parallel
 * chunk rendering: same t in, same value out, no simulation state.
 * ease(p) cubic ease-out — never overshoots, use for alpha
 * easeInOut(p) cubic in-out — gentle symmetric ramps
 * easeBack(p) overshoots to ~1.1 then settles — snappy pop-in
 * easeElastic(p) rubber-band wobble — playful settle
 * springy(p, stiffness, damping) exact damped-harmonic response (mass=1, closed form) —
 * physical bounce; stiffer = faster, less damping = more overshoot.
 * Curves may overshoot past 1 by design: use them for scale/position, not alpha. */
const easeInOut = p => { p = clamp01(p); return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
const easeBack = p => { p = clamp01(p); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const easeElastic = p => { p = clamp01(p); if (p === 0 || p === 1) return p; const c4 = (2 * Math.PI) / 3; return Math.pow(2, -10 * p) * Math.sin((p * 10 - .75) * c4) + 1; };
const springy = (p, stiffness = 170, damping = 12) => {
  if (p <= 0) return 0;
  const w0 = Math.sqrt(stiffness), z = Math.min(.999, damping / (2 * w0));
  const wd = w0 * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w0 * p) * (Math.cos(wd * p) + (z * w0 / wd) * Math.sin(wd * p));
};


const rv = (o, n, r = 1.7) => o.i < n ? 0 : o.i === n ? Math.min(1, o.lp * r) : 1;

Object.assign(globalThis, { ease,easeInOut,easeBack,easeElastic,springy,rv });
})();
