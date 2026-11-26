/**
 * @file features/character.js — mascot character renderer — poses, hair, faces, person(), and lip sync helpers.
 * Part of the aiyu template runtime. Layer rules: core ← features ← story.
 */

const POSE = {
  idle: [[.14, .28], [.14, .28]],
  fold: [[.16, -2.65], [.16, -2.65]],
  point: [[.14, .28], [.8, .95]],
  open: [[.55, .9], [.55, .9]],
};


function hairBack(c) {
  if (c.hs === 'longF' || c.hs === 'bob' || c.hs === 'blonde') {
    const len = c.hs === 'longF' ? 300 : c.hs === 'blonde' ? 240 : 200;
    const wd = c.hs === 'longF' ? 172 : 224;
    if (c.hs === 'longF') {
      g.beginPath();
      g.moveTo(-wd / 2, -136); g.lineTo(wd / 2, -136); g.lineTo(wd / 2, -136 + len - 60);
      for (let i = 0; i < 3; i++) {
        const x0 = wd / 2 - i * (wd / 3), x1 = wd / 2 - (i + 1) * (wd / 3);
        g.quadraticCurveTo(x0 - wd / 12, -136 + len - 10, x1, -136 + len - 60);
      }
      g.closePath();
      g.fillStyle = c.hair; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
      LINE([[-wd / 2 + 18, -80], [-wd / 2 + 30, -136 + len - 80]], 7);
      LINE([[wd / 2 - 24, -60], [wd / 2 - 34, -136 + len - 90]], 7);
    } else {
      g.beginPath(); g.roundRect(-wd / 2, -136, wd, len, 58); g.fillStyle = c.hair; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
    }
  }
  if (c.hs === 'pony') {
    CIRC(58, -118, 42, c.hair); CIRC(58, -118, 42, null, OW);
    g.beginPath(); g.arc(34, -120, 30, -2.4, 1.2); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
  }
}
function hairFront(c) {
  const Hr = c.hair;
  if (c.hs === 'none') return;
  if (c.hs === 'jensen') {
    g.beginPath(); g.arc(0, -4, 102, Math.PI, 2 * Math.PI);
    g.quadraticCurveTo(40, -96, 104, -30); g.lineTo(104, -64);
    g.fillStyle = Hr; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.lineJoin = 'round'; g.stroke();
    g.beginPath();
    g.moveTo(-102, -6); g.quadraticCurveTo(-70, -118, 30, -104);
    g.quadraticCurveTo(88, -94, 102, -40); g.lineTo(104, -64);
    g.quadraticCurveTo(96, -136, 4, -140); g.quadraticCurveTo(-88, -142, -102, -40);
    g.closePath();
    g.fill(); g.stroke();
    LINE([[-40, -120], [-78, -66]], 8);
    LINE([[10, -124], [-10, -96]], 7);
    LINE([[52, -108], [74, -70]], 7);
    if (!c.young) {
      g.beginPath(); g.moveTo(-60, -118); g.quadraticCurveTo(-96, -84, -78, -28); g.quadraticCurveTo(-56, -60, -60, -118);
      g.fillStyle = '#a9abb0'; g.fill(); g.lineWidth = 6; g.strokeStyle = OL; g.stroke();
    } else {
      g.beginPath(); g.moveTo(-58, -118); g.quadraticCurveTo(-88, -84, -74, -34); g.quadraticCurveTo(-54, -62, -58, -118);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fill();
    }
    return;
  }
  if (c.hs === 'swoop') {
    g.beginPath(); g.arc(0, -4, 100, Math.PI * 1.02, Math.PI * 1.98);
    g.quadraticCurveTo(-50, -138, -98, -34); g.quadraticCurveTo(-60, -60, -30, -52);
    g.fillStyle = Hr; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
    LINE([[-64, -70], [30, -84]], 8);
    return;
  }
  g.beginPath(); g.arc(0, 0, 101, Math.PI, 2 * Math.PI); g.quadraticCurveTo(0, -78, -101, 0);
  g.fillStyle = Hr; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
  if (c.hs === 'longF') {
    g.beginPath();
    g.moveTo(-101, -10); g.quadraticCurveTo(-92, -108, 0, -112);
    g.quadraticCurveTo(92, -108, 101, -10);
    g.quadraticCurveTo(64, -52, 6, -34); g.quadraticCurveTo(0, -32, -6, -34);
    g.quadraticCurveTo(-64, -52, -101, -10);
    g.closePath();
    g.fillStyle = Hr; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
    LINE([[-78, -40], [-92, 42]], 9); LINE([[78, -40], [92, 42]], 9);
    LINE([[-30, -96], [-58, -52]], 6); LINE([[28, -94], [50, -50]], 6);
  }
  if (c.hs === 'bob' || c.hs === 'blonde') {
    LINE([[-84, -34], [-96, 52]], 10); LINE([[84, -34], [96, 52]], 10);
    if (c.hs === 'blonde') { g.beginPath(); g.arc(0, -6, 97, Math.PI * 1.1, Math.PI * 1.9); g.strokeStyle = Hr; g.lineWidth = 16; g.stroke(); }
  }
  if (c.hs === 'pony') {
    g.beginPath(); g.arc(0, -6, 99, Math.PI * 1.08, Math.PI * 1.92); g.strokeStyle = Hr; g.lineWidth = 18; g.stroke();
  }
}
function face(c, o) {
  const ex = 40, ey = 2, lk = o.look || 1, mood = o.mood || c.mood || 'neutral';
  const brow = {
    neutral: [-32, -35, 8], smile: [-31, -36, 8],
    worry: [-43, -28, 8], hurt: [-40, -24, 8],
    tense: [-22, -39, 10], resolute: [-26, -38, 9],
    shocked: [-50, -46, 9],
  }[mood] || [-32, -35, 8];
  for (const s of [-1, 1]) LINE([[s * 18, ey + brow[0]], [s * 63, ey + brow[1]]], brow[2]);
  if (c.glasses) {
    for (const s of [-1, 1]) {
      g.beginPath(); g.roundRect(s * ex - 38, ey - 30, 76, 58, 10);
      g.fillStyle = mood === 'shocked' ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.10)'; g.fill();
      g.lineWidth = 10; g.strokeStyle = OL; g.stroke();
      CIRC(s * ex + lk * 5, ey + (mood === 'shocked' ? 2 : 4), mood === 'shocked' ? 7 : 9, OL, 0);
      if (mood === 'shocked') CIRC(s * ex + lk * 5 - 3, ey - 1, 2.5, '#f4f1ea', 0);
      if (mood === 'tense' || mood === 'resolute') LINE([[s * ex - 26, ey - 12], [s * ex + 26, ey - 15]], 5);
    }
    LINE([[-6, ey - 4], [6, ey - 4]], 8);
    LINE([[-ex - 38, ey - 10], [-98, ey - 22]], 7); LINE([[ex + 38, ey - 10], [98, ey - 22]], 7);
  } else for (const s of [-1, 1]) {
    const X = s * ex;
    let slim = c.lashes ? 17 : 21;
    if (mood === 'tense') slim = 13;
    if (mood === 'hurt') slim = 15;
    if (mood === 'resolute') slim = 17;
    if (mood === 'shocked') slim = 27;
    if (o.blink) LINE([[X - 18, ey], [X + 18, ey]], 8);
    else {
      g.beginPath(); g.ellipse(X, ey, 19, slim, 0, 0, 7); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 6; g.strokeStyle = OL; g.stroke();
      CIRC(X + lk * 7, ey + 2, mood === 'shocked' ? 7 : 9, OL, 0);
      if (mood === 'shocked') CIRC(X + lk * 7 - 3, ey - 2, 2.5, '#f4f1ea', 0);
      if (mood === 'tense' || mood === 'resolute') LINE([[X - 17, ey - slim + 3], [X + 17, ey - slim + 1]], 5);
      if (c.lashes) { LINE([[X + s * 14, ey - 12], [X + s * 24, ey - 20]], 5); LINE([[X + s * 6, ey - 15], [X + s * 14, ey - 26]], 5); }
    }
  }
  g.beginPath(); g.moveTo(0, 14); g.quadraticCurveTo(10, 30, -4, 34); g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
  const my = 62, m = o.mouth || 0;
  if (mood === 'shocked') {
    g.beginPath(); g.ellipse(0, my + 2, 16, 22, 0, 0, 7); g.fillStyle = '#4a1e1e'; g.fill(); g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
  } else if (m > .08) {
    g.beginPath(); g.ellipse(0, my, 13, 8 + m * 8, 0, 0, 7); g.fillStyle = '#4a1e1e'; g.fill(); g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
  } else if (mood === 'smile') {
    g.beginPath(); g.moveTo(-18, my - 2); g.quadraticCurveTo(0, my + 12, 18, my - 2); g.lineWidth = 7; g.strokeStyle = OL; g.lineCap = 'round'; g.stroke();
    LINE([[-22, my - 8], [-16, my - 2]], 5); LINE([[22, my - 8], [16, my - 2]], 5);
  } else if (mood === 'resolute') {
    g.beginPath(); g.moveTo(-19, my + 2); g.quadraticCurveTo(0, my + 9, 20, my - 4); g.lineWidth = 7; g.strokeStyle = OL; g.lineCap = 'round'; g.stroke();
  } else if (mood === 'tense') {
    g.beginPath(); g.moveTo(-18, my + 2); g.lineTo(18, my + 1); g.lineWidth = 7; g.strokeStyle = OL; g.lineCap = 'round'; g.stroke();
    LINE([[-20, my + 2], [-15, my + 8]], 5); LINE([[20, my + 1], [15, my + 8]], 5);
  } else if (mood === 'hurt' || mood === 'worry') {
    g.beginPath(); g.moveTo(-14, my + 5); g.quadraticCurveTo(0, my - 5, 14, my + 5); g.lineWidth = 7; g.strokeStyle = OL; g.lineCap = 'round'; g.stroke();
  } else {
    g.beginPath(); g.moveTo(-15, my); g.quadraticCurveTo(0, my + 5, 15, my); g.lineWidth = 7; g.strokeStyle = OL; g.lineCap = 'round'; g.stroke();
  }
}
/**
 * Draw a character defined in CH.
 * @param {string} id - key of CH (e.g. 'host')
 * @param {object} o
 * @param {number} o.x - center x (feet baseline) @param {number} o.y - feet baseline y
 * @param {number} [o.scale=1] @param {number} o.t - time in seconds (drives idle bob)
 * @param {boolean} [o.flip] - mirror horizontally @param {boolean} [o.back] - back turned
 * @param {boolean} [o.walk] @param {boolean} [o.sit]
 * @param {number} [o.look=1] - facing direction -1..1
 * @param {boolean} [o.blink] - eyes closed this frame (e.g. (o.t % 3.4) < .12)
 * @param {string} [o.mood] - 'neutral'|'smile'|'worry'|'hurt'|'tense'|'resolute'
 * @param {number} [o.mouth] - mouth openness 0..1, use mouthFor() for lip sync
 * @param {string} [o.pose] - 'idle'|'fold'|'point'|'open' (or pass o.arms=[[a,b],[a,b]])
 */
function person(id, o) {
  const c = CH[id], t = o.t || 0, s = o.scale || 1, bw = c.bw || 1, bob = o.sit ? 0 : Math.sin(t * 2.1) * 3;
  g.save(); g.translate(o.x, o.y); g.scale(o.flip ? -s : s, s);
  if (!o.sit) { g.beginPath(); g.ellipse(0, 6, 108 * bw, 18, 0, 0, 7); g.fillStyle = 'rgba(0,0,0,.22)'; g.fill(); }
  const wv = o.walk ? Math.sin(t * 7) * 24 : 0;
  if (!o.sit) for (const sd of [-1, 1]) {
    const fx = sd * (44 * bw + wv);   // legs alternate: sd*(44bw+wv) — sd*(44bw+wv*sd) collapses to in-unison motion
    LIMB(sd * 38 * bw, -178, fx, -14, 52, c.bot || '#26262b');
    g.beginPath(); g.ellipse(fx + sd * 4, -6, 32, 13, 0, 0, 7); g.fillStyle = c.ghost ? c.top : '#20242c'; g.fill(); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
  }
  const TW = 106 * bw;
  if (c.dress) SHAPE([[-TW, -392], [TW, -392], [TW + 44, -160], [-TW - 44, -160]], c.top);
  else SHAPE([[-TW, -394], [TW, -394], [TW - 8, -178], [-TW + 8, -178]], c.top);
  if (c.jacket) {
    g.strokeStyle = '#3d3d45'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, -382); g.lineTo(0, -188); g.stroke();
    SHAPE([[-60, -394], [-10, -394], [-34, -332], [-68, -350]], '#28282e');
    SHAPE([[60, -394], [10, -394], [34, -332], [68, -350]], '#28282e');
    LINE([[-78, -392], [-52, -300]], 5); LINE([[78, -392], [52, -300]], 5);
    g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 8; g.beginPath(); g.moveTo(-84, -386); g.lineTo(-88, -220); g.stroke();
  }
  if (c.suit) {
    SHAPE([[-44, -394], [44, -394], [28, -296], [-28, -296]], '#f0eee7');
    SHAPE([[-15, -390], [15, -390], [21, -316], [0, -298], [-21, -316]], c.tie);
    SHAPE([[-60, -394], [-10, -394], [-36, -328], [-68, -348]], c.top);
    SHAPE([[60, -394], [10, -394], [36, -328], [68, -348]], c.top);
  }
  if (c.blazer) { g.strokeStyle = '#2b3442'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, -386); g.lineTo(0, -300); g.stroke(); }
  if (c.floral) for (const [fx, fy, fc] of [[-58, -238, '#d97a8a'], [34, -268, '#e8b84c'], [82, -208, '#d97a8a'], [-88, -196, '#e8b84c'], [58, -322, '#d97a8a'], [-30, -330, '#f0d5da'], [90, -300, '#f0d5da'], [-70, -280, '#d97a8a']]) CIRC(fx, fy, 10, fc, 4);
  g.fillStyle = c.skin; g.fillRect(-26, -428, 52, 46);
  const arms = o.arms || (o.pose ? POSE[o.pose] : POSE.idle);
  [-1, 1].forEach((side, k) => {
    const [a, b] = arms[k], sx = side * TW - side * 2, sy = -378;
    const ex = sx + side * 148 * Math.sin(a), ey = sy + 148 * Math.cos(a);
    const wx = ex + side * 134 * Math.sin(b), wy = ey + 134 * Math.cos(b);
    LIMB(sx, sy, ex, ey, 52, c.top); LIMB(ex, ey, wx, wy, 42, c.skin); CIRC(wx, wy, 25, c.skin);
  });
  g.translate(0, -488 + bob);
  hairBack(c);
  g.beginPath(); g.arc(0, 0, 98, 0, 7); g.fillStyle = o.back ? c.hair : c.skin; g.fill();
  if (!o.back && !c.ghost) { g.save(); g.clip(); g.beginPath(); g.arc(-24, -8, 96, 0, 7); g.fillStyle = 'rgba(0,0,0,.08)'; g.fill(); g.restore(); }
  g.beginPath(); g.arc(0, 0, 98, 0, 7); g.lineWidth = OW; g.strokeStyle = OL; g.stroke();
  hairFront(c);
  if (!o.back && c.earring) { CIRC(-96, 34, 9, c.earring, 5); CIRC(96, 34, 9, c.earring, 5); }
  if (o.back) { g.beginPath(); g.arc(-22, -16, 62, Math.PI * 1.15, Math.PI * 1.55); g.lineWidth = 12; g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineCap = 'round'; g.stroke(); }
  else if (!c.ghost) face(c, o);
  g.restore();
}


const ms = o => o.em * 1.6;
/** Mouth openness for one character: envelope only while lines carry this spk, else 0.
 *  Always use this for lip sync — feeding o.em directly makes every character chew along.
 *  @param {string} who - single-letter speaker id matching spk in dialogue.txt
 *  @param {object} o - scene object @returns {number} 0..1 mouth openness */
const mouthFor = (who, o) => (o.line && o.line.spk === who ? ms(o) : 0);
