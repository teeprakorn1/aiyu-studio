/**
 * features/people.js — realistic-stylized human renderer (optional module)
 * ----------------------------------------------------------------
 * Extracted from the real production of `thai-origins` (examples/legacy/thai-origins/).
 * An alternative to the core person() when mascot proportions don't fit the story:
 *
 *   person()      — 3-heads-tall mascot, big googly eyes, capsule limbs.
 *                   Great for presenter/news formats (jensen-legend).
 *   personTH()    — ~5.5-heads-tall human: tapered head, almond eyes, visible neck,
 *                   two-segment limbs WITH knees/elbows, correct alternating walk
 *                   cycle, whole-body bob. Great for historical/cinematic stories.
 *
 * LOAD ORDER: after core/ runtime files (needs g, OL, lerp), before story/style.js.
 * Usage:  personTH('merchant', { x, y, scale, t, walk, walkSpeed, look, blink, mood, phase })
 *   - feet baseline is y, up is negative; total height ~520 local units before scale
 *   - walk cycle: phase 0..1, sin-driven; phase .25 = maximum leg spread mid-stride
 *   - register your own characters with definePeople() in story/style.js (skin/hair/cloth/sash/hairStyle)
 *   - background figures: draw opaque with mixHex() toward the background color —
 *     alpha-faded humans read as ghosts
 */
// NOTE: same IIFE/window-export pattern as atmosphere.js — declares nothing at global
// scope, so copied code re-declaring these names never collides.

(() => {
// Local units: feet baseline y=0, up is negative.
// Total height ~520 units; head ~130 (about 5.5 heads tall, incl. hair mass).

const DEFAULT_PCH = {
  merchant: { skin: '#B97B50', skinShade: '#9A6340', hair: '#211B18', cloth: '#8F3F34', sash: '#D6A03D', hairStyle: 'topknot', fillet: true },
  monk:     { skin: '#9A6340', skinShade: '#7C4B32', hair: '#211B18', cloth: '#C77B32', sash: '#A85F22', hairStyle: 'shaved', robe: true },
  villager: { skin: '#B97B50', skinShade: '#9A6340', hair: '#211B18', cloth: '#4A5A52', sash: '#C9B48A', hairStyle: 'topknot' },
  laborer:  { skin: '#8F5A3A', skinShade: '#7C4B32', hair: '#211B18', cloth: '#5A4A38', sash: null, hairStyle: 'topknot' },
};

// thin-outlined filled path helper (local scale, not the core heavy OW)
function thFS(fill, lw = 5) {
  g.fillStyle = fill; g.fill();
  if (lw) { g.lineWidth = lw; g.strokeStyle = OL; g.lineJoin = 'round'; g.stroke(); }
}

function thStroke(w, col = OL) {
  g.lineWidth = w; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
}

function thLimb(x1, y1, x2, y2, w, fill, lw = 5) {
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
  g.strokeStyle = OL; g.lineWidth = w + lw * 2; g.stroke();
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
  g.strokeStyle = fill; g.lineWidth = w; g.stroke();
}

function thHead() {
  // tapered head: wide at cheeks, narrower chin; center at (0,0), ~114 wide, ~132 tall
  g.beginPath();
  g.moveTo(0, -66);
  g.bezierCurveTo(40, -66, 56, -42, 54, -6);
  g.bezierCurveTo(52, 30, 30, 66, 0, 66);
  g.bezierCurveTo(-30, 66, -52, 30, -54, -6);
  g.bezierCurveTo(-56, -42, -40, -66, 0, -66);
  g.closePath();
}

function thEar(sd, skin) {
  g.beginPath(); g.ellipse(sd * 53, 0, 8, 14, 0, 0, Math.PI * 2);
  thFS(skin, 4);
}

function thHair(style, col) {
  if (style === 'shaved' || style === 'none') return;
  // hair cap following crown with slight widow's peak
  g.beginPath();
  g.moveTo(-54, -8);
  g.bezierCurveTo(-56, -48, -32, -68, 0, -68);
  g.bezierCurveTo(32, -68, 56, -48, 54, -8);
  g.quadraticCurveTo(38, -34, 16, -30);
  g.quadraticCurveTo(4, -26, -8, -30);
  g.quadraticCurveTo(-34, -34, -54, -8);
  g.closePath();
  thFS(col, 4.5);
  if (style === 'topknot') {
    g.beginPath(); g.ellipse(0, -76, 14, 18, 0, 0, Math.PI * 2);
    thFS(col, 4.5);
  }
}

function thFillet() {
  g.beginPath();
  g.moveTo(-44, -32); g.quadraticCurveTo(0, -42, 44, -32);
  thStroke(4.5, '#C9A54E');
}

function thFace(c, o, detail) {
  const lk = o.look !== undefined ? o.look : 0;
  const mood = o.mood || 'neutral';
  const m = o.mouth || 0;
  if (!detail) return;
  for (const sd of [-1, 1]) {
    // brow
    const browY = mood === 'worry' ? -26 : -30;
    g.beginPath();
    g.moveTo(sd * 12, browY + (sd < 0 && mood === 'worry' ? -3 : 0));
    g.quadraticCurveTo(sd * 24, browY - 4, sd * 36, browY + 2);
    thStroke(4);
    // eye
    if (o.blink) {
      g.beginPath();
      g.moveTo(sd * 24 - 9, -10); g.quadraticCurveTo(sd * 24, -6, sd * 24 + 9, -10);
      thStroke(4);
    } else {
      g.beginPath(); g.ellipse(sd * 24, -9, 10, 6.5, 0, 0, Math.PI * 2);
      g.fillStyle = '#F2E8D5'; g.fill();
      g.lineWidth = 3; g.strokeStyle = OL; g.stroke();
      g.beginPath(); g.arc(sd * 24 + lk * 3, -8, 4.4, 0, Math.PI * 2);
      g.fillStyle = '#1d1a17'; g.fill();
      g.beginPath(); g.arc(sd * 24 + lk * 3 - 1.4, -9.6, 1.3, 0, Math.PI * 2);
      g.fillStyle = '#fff'; g.fill();
    }
  }
  // nose: single small stroke
  g.beginPath();
  g.moveTo(2, 2); g.quadraticCurveTo(8, 12, -1, 16);
  thStroke(3.5);
  // mouth
  const my = 38;
  if (m > .08) {
    g.beginPath(); g.ellipse(0, my, 11, 5 + m * 8, 0, 0, Math.PI * 2);
    g.fillStyle = '#5A2620'; g.fill();
    g.lineWidth = 3.5; g.strokeStyle = OL; g.stroke();
  } else if (mood === 'worry') {
    g.beginPath(); g.moveTo(-11, my + 4); g.quadraticCurveTo(0, my - 2, 11, my + 4);
    thStroke(4);
  } else {
    g.beginPath(); g.moveTo(-13, my); g.quadraticCurveTo(0, my + 7, 13, my);
    thStroke(4);
  }
}

function thTorso(c, robe) {
  // curved torso: shoulders -356..-342, waist -228
  g.beginPath();
  g.moveTo(-58, -342);
  g.quadraticCurveTo(-30, -358, 0, -358);
  g.quadraticCurveTo(30, -358, 58, -342);
  g.bezierCurveTo(62, -304, 54, -262, 44, -228);
  g.lineTo(-44, -228);
  g.bezierCurveTo(-54, -262, -62, -304, -58, -342);
  g.closePath();
  thFS(robe ? c.cloth : c.skin, 5.5);
  // subtle chest shading
  if (!robe) {
    g.save();
    g.beginPath();
    g.moveTo(-58, -342);
    g.quadraticCurveTo(-30, -358, 0, -358);
    g.quadraticCurveTo(30, -358, 58, -342);
    g.bezierCurveTo(62, -304, 54, -262, 44, -228);
    g.lineTo(-44, -228);
    g.bezierCurveTo(-54, -262, -62, -304, -58, -342);
    g.closePath();
    g.clip();
    g.fillStyle = 'rgba(0,0,0,.12)';
    g.fillRect(18, -360, 50, 140);
    g.restore();
  }
}

function thSash(col) {
  // diagonal shoulder cloth from left shoulder to right hip
  g.beginPath();
  g.moveTo(-52, -348);
  g.lineTo(-28, -356);
  g.lineTo(56, -236);
  g.lineTo(44, -218);
  g.closePath();
  thFS(col, 4);
}

function thWaistcloth(c, longRobe) {
  const hemY = longRobe ? -40 : -96;
  g.beginPath();
  g.moveTo(-48, -240);
  g.quadraticCurveTo(0, -250, 48, -240);
  g.lineTo(52, hemY - 8);
  g.quadraticCurveTo(28, hemY, 0, hemY + (longRobe ? 4 : 10));
  g.quadraticCurveTo(-28, hemY, -52, hemY - 8);
  g.closePath();
  thFS(c.cloth, 5);
  // center fold
  g.beginPath();
  g.moveTo(0, -234); g.quadraticCurveTo(4, -160, 0, hemY);
  thStroke(3.5, 'rgba(0,0,0,.4)');
  // waist cord
  g.beginPath();
  g.moveTo(-46, -238); g.quadraticCurveTo(0, -246, 46, -238);
  thStroke(4.5, '#2A1C12');
}

function thFoot(x, y, sd, skin) {
  g.beginPath();
  g.ellipse(x + sd * 8, y + 2, 19, 7.5, sd * .1, 0, Math.PI * 2);
  thFS(skin, 4);
}

/**
 * personTH — period human renderer
 * @param {string} id - key registered with definePeople()
 * @param {object} o - {x, y, scale, t, walk, walkSpeed, look, flip, blink, mood, mouth, phase, sway}
 *   x,y = feet baseline. look: -1 left, 0 front, 1 right (pupil shift + slight head hint).
 */
function personTH(id, o) {
  const c = personConfigOf(id);
  const t = o.t || 0, s = o.scale || 1;
  const detail = s >= .42 && !o.noFace;
  g.save();
  g.translate(o.x, o.y);
  g.scale(o.flip ? -s : s, s);
  if (o.alpha !== undefined) g.globalAlpha *= o.alpha;

  // contact shadow
  g.save();
  g.globalAlpha *= .3;
  g.beginPath(); g.ellipse(0, 8, 74, 13, 0, 0, Math.PI * 2);
  g.fillStyle = '#000'; g.fill();
  g.restore();

  // walk phase math — legs genuinely alternate
  const walking = !!o.walk;
  const rate = o.walkSpeed || 1.6;
  const w = ((t * rate + (o.phase || 0)) % 1) * Math.PI * 2;
  const swingL = walking ? Math.sin(w) * 30 : 0;
  const swingR = walking ? -Math.sin(w) * 30 : 0;
  const liftL = walking ? Math.max(0, Math.cos(w)) * 16 : 0;
  const liftR = walking ? Math.max(0, -Math.cos(w)) * 16 : 0;
  const bob = walking ? -Math.abs(Math.sin(w)) * 7 : Math.sin(t * 1.7 + (o.phase || 0) * 6) * 1.6;
  const armL = walking ? -Math.sin(w) * .3 : .12;
  const armR = walking ? Math.sin(w) * .3 : .12;
  const lean = walking ? .05 : 0;

  g.translate(0, bob);
  g.rotate(lean);

  // ── legs (two-segment, skin shin below hem) ──
  const robe = !!c.robe;
  const hemY = robe ? -40 : -96;
  for (const sd of [-1, 1]) {
    const swing = sd < 0 ? swingL : swingR;
    const lift = sd < 0 ? liftL : liftR;
    const hipX = sd * 22, hipY = -216;
    const kneeX = sd * 26 + swing * .45, kneeY = -120 - lift * .25;
    const footX = sd * 28 + swing, footY = -18 - lift;
    if (hemY > kneeY - 10) {
      // robe covers thigh: draw only shin
      thLimb(kneeX, kneeY - 30, footX, footY, 22, c.skin);
    } else {
      thLimb(hipX, hipY, kneeX, kneeY, 26, c.skin);
      thLimb(kneeX, kneeY, footX, footY, 20, c.skin);
    }
    thFoot(footX, footY, sd, c.skin);
  }

  // ── torso + clothing ──
  thTorso(c, robe);
  if (!robe && c.sash) thSash(c.sash);
  if (robe) {
    // monk robe diagonal seam
    g.beginPath();
    g.moveTo(-34, -352); g.lineTo(40, -232);
    thStroke(5, 'rgba(0,0,0,.25)');
  }
  thWaistcloth(c, robe);

  // ── arms (two-segment, counter-swing) ──
  for (const sd of [-1, 1]) {
    const a = sd < 0 ? armL : armR;
    const shoulderX = sd * 52, shoulderY = -338;
    const elbowX = shoulderX + sd * 14 + Math.sin(a) * 40 * sd;
    const elbowY = shoulderY + 78;
    const handX = elbowX + Math.sin(a * 1.3) * 46 * sd + sd * 4;
    const handY = elbowY + 72;
    thLimb(shoulderX, shoulderY, elbowX, elbowY, 23, robe ? c.cloth : c.skin, 4.5);
    thLimb(elbowX, elbowY, handX, handY, 18, c.skin, 4.5);
    g.beginPath(); g.ellipse(handX, handY + 4, 11, 14, 0, 0, Math.PI * 2);
    thFS(c.skin, 4);
  }

  // ── neck ──
  g.beginPath();
  g.moveTo(-15, -380); g.lineTo(15, -380); g.lineTo(13, -352); g.lineTo(-13, -352);
  g.closePath();
  thFS(c.skinShade, 4);

  // ── head ──
  g.save();
  g.translate(0, -436);
  const lk = o.look !== undefined ? o.look : 0;
  if (lk) g.translate(lk * 3, 0);
  thEar(-1, c.skin); thEar(1, c.skin);
  thHead();
  thFS(c.skin, 5.5);
  // soft cheek shading
  g.save();
  thHead(); g.clip();
  g.fillStyle = 'rgba(0,0,0,.07)';
  g.fillRect(16, -70, 50, 140);
  g.restore();
  thHair(c.hairStyle, c.hair);
  if (c.fillet) thFillet();
  thFace(c, o, detail);
  g.restore();

  g.restore();
}

definePeople(DEFAULT_PCH);
Object.assign(globalThis, { personTH });
})();
