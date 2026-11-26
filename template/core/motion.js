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

/* Word-level reveal helpers — keyword-beat triggering: scene elements pop exactly when the
 * narration speaks a keyword, not at line start. Word timing comes from talk.js line.words
 * (tts-gen word boundaries, auto-segment emission, or phoneme alignment).
 * IRON RULE — fallback contract: if the line has no word timing or the needle is not found,
 * rvw degrades to plain rv(). Scenes must never break because word data is absent. */

// normalize for fuzzy word matching — lowercase, strip non-letters (Thai subword tolerance)
const wnorm = s => String(s == null ? '' : s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** Find the absolute time (seconds) of the first word in line ln matching needle.
 * @param {object} ln - talk.js line object with optional .words [{w,t0,t1}]
 * @param {string} needle - keyword to find; matches if either contains the other after normalization
 * @returns {number|null} absolute seconds of word start, or null when unavailable/unmatched */
const wordT = (ln, needle) => {
  if (!ln || !ln.words || !ln.words.length) return null;
  const target = wnorm(needle);
  if (!target) return null;
  for (const wd of ln.words) {
    const cand = wnorm(wd.w != null ? wd.w : wd[0]);
    if (cand && (cand.includes(target) || target.includes(cand))) return wd.t0 != null ? wd.t0 : wd[1];
  }
  return null;
};

/** Reveal progress keyed to a spoken keyword inside line n — same shape as rv():
 * 0 before the word, ramps up after it, 1 once the line ends. Falls back to rv() exactly
 * when word timing is missing or the needle is absent — scenes never break.
 * @param {object} o - render context (.i current line index, .lp line progress 0..1, .line current line)
 * @param {number} n - line index the reveal belongs to
 * @param {string} needle - keyword whose spoken moment starts the reveal
 * @param {number} [r=1.7] - ramp rate, same meaning as rv()
 * @returns {number} progress 0..1 */
const rvw = (o, n, needle, r = 1.7) => {
  if (o.i !== n) return o.i < n ? 0 : 1;
  const ln = o.line;
  const wt = wordT(ln, needle);
  if (wt == null || !ln || !ln.dur) return rv(o, n, r);
  const tline = o.lp * ln.dur;              // seconds into the line
  const woff = Math.max(0, wt - ln.t0);     // word offset within the line (seconds)
  const remain = ln.dur - woff;
  if (remain <= 0.001) return rv(o, n, r);
  const wp = (tline - woff) / remain;       // word-relative progress through the remainder
  if (wp <= 0) return 0;
  return Math.min(1, wp * r);
};

Object.assign(globalThis, { ease,easeInOut,easeBack,easeElastic,springy,rv,wordT,rvw });
})();
