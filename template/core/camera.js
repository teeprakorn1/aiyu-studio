/**
 * @file core/camera.js — camera transforms — zoom() primitive and cam() scene-scoped zoom helper.
 * Part of the aiyu template runtime. Layer rules: core ← features ← story.
 */

const zoom = (o, fn, z0, z1, cx = W / 2, cy = H * .6) => {
  const z = z0 + (z1 - z0) * ease(o.p);
  g.save(); g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy); fn(); g.restore();
};
/**
 * Camera transform: slow zoom across the scene + punch kick on new lines + drift.
 * Wrap background and characters inside fn; keep headings/cards outside if they
 * should not move with the camera.
 * ⚠ positions inside cam are shifted by zoom: actual = cy + (val - cy) * z — see safe zones.
 * @param {object} o - scene object passed to the scene function
 * @param {object} cfg
 * @param {number} [cfg.z0=1.045] - zoom at scene start @param {number} [cfg.z1=1.085] - zoom at end
 * @param {number} [cfg.cx=W/2] @param {number} [cfg.cy=H*.58] - zoom center (cy is safe-zone critical)
 * @param {number} [cfg.punch=.022] - zoom kick intensity at each new line
 * @param {number} [cfg.driftX=6] @param {number} [cfg.driftY=4] - slow float amplitude
 * @param {number} [cfg.x0] [cfg.x1] [cfg.y0] [cfg.y1] - pan offsets over scene progress
 * @param {function} fn - draw callback executed inside the camera transform
 */
function cam(o, cfg, fn) {
  const q = ease(o.p), z0 = cfg.z0 ?? 1.045, z1 = cfg.z1 ?? 1.085;
  const elapsed = o.lp * ((o.line && o.line.dur) || 4);
  const punch = (cfg.punch ?? .022) * clamp01(1 - elapsed / (cfg.punchDur || .55));
  const z = lerp(z0, z1, q) + punch;
  const px = lerp(cfg.x0 ?? 0, cfg.x1 ?? 0, q) + Math.sin(o.t * (cfg.swx ?? .22) + (cfg.phase ?? 0)) * (cfg.driftX ?? 6);
  const py = lerp(cfg.y0 ?? 0, cfg.y1 ?? 0, q) + Math.cos(o.t * (cfg.swy ?? .17) + (cfg.phase ?? 0)) * (cfg.driftY ?? 4);
  const cx = cfg.cx ?? W / 2, cy = cfg.cy ?? H * .58;
  g.save(); g.translate(cx + px, cy + py); g.scale(z, z); g.translate(-cx, -cy); fn(); g.restore();
}
