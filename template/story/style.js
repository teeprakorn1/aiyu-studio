// story/style.js — main per-story scene file: characters, scenes, scene registration, footnote.
// core/features provide all machinery: person/cam/TXT/RRECT/pop/chip/cards/subs — never edit those layers.
// Configuration is explicit: defineCharacters(), defineScenes(), and setFootnote() register this story with the runtime.
// This file is a working teaching demo: 3 scenes covering every core pattern (delete and write your own).

const FOOTNOTE_TEXT = 'Template demo · simulated visuals and characters';

// ── Characters ────────────────────────────────────────────
// key = the id passed to person() · hs (hairstyle): jensen|swoop|bob|blonde|longF|pony|none
// clothing flags: jacket / suit+tie / blazer / dress+floral · extras: glasses lashes earring ghost bw(width) young mood
const CH = {
  host:  { skin: '#d9a06e', hair: '#7d8087', top: '#1c1c20', bot: '#25262c', hs: 'jensen', jacket: true, glasses: true },
  guest: { skin: '#e8bf9a', hair: '#6e6257', top: '#5d6d7e', hs: 'bob', lashes: true },
};

// ── Backgrounds (composed from core primitives) ─────────────
function bgNight() {
  wall('#101623', '#05070d');
  stars(40);
  city(0, 1080, 1080, 340, 16, '#0d1220');
  floorY(1420, '#0a0d14');
  vig();
}
function bgStudio() {
  wall('#1a1620', '#0c0a0f');
  glow(540, 500, 700, '255,220,140', .18);
  floorY(1450, '#141118');
  vig();
}

// ── Scenes — each receives o = {t, p, i, lp, line, em} ─────
//   o.t    current time in seconds · o.p  scene progress 0..1 (drives cam zoom)
//   o.i    current dialogue line index (progressive reveals: if (o.i >= n))
//   o.lp   progress within the line · o.line  access spk/txt · mouthFor('X', o) = lipsync
// ⚠ safe zone: keep clear of 0–260px top and below y≈1490 (except subtitles) —
//   cam() zoom shifts real positions, see docs/authoring/01-scenes.md safe-zone section

// Opening scene (lines 0–2): back-turned figure + hook text — the cold-open pattern
function scOpening(o) {
  cam(o, { z0: 1.05, z1: 1.13, cy: 1060, punch: .018, driftX: 5 }, () => {
    bgNight();
    rain(.07, 20);
    person('host', { x: 540, y: 1660, scale: .95, t: o.t, back: true });
    rim(540, 1660, .95, 1, 'rgba(118,185,0,.4)');
  });
  pop('Big News', 540, 430, '#e05252', Math.min(1, o.p * 2.2), 150);
  TXT('a cold-open example scene', 540, 520, 40, '#e8dede', 'center', 600);
}

// Dialogue scene (lines 3–7): two characters + speaker-aware lipsync —
// mouths move only while each character's own spk is active
function scTalk(o) {
  cam(o, { z0: 1.04, z1: 1.09, x0: 6, x1: -6, cy: 1000, punch: .02, driftX: 4 }, () => {
    bgStudio();
    tint('4,4,10', .2);
    person('host', { x: 320, y: 1560, scale: 1.0, t: o.t, look: 1, blink: (o.t % 3.4) < .12, mood: 'smile', mouth: mouthFor('H', o) });
    person('guest', { x: 800, y: 1560, scale: .92, t: o.t, flip: true, look: -1, blink: (o.t % 4.1) < .12, mouth: mouthFor('G', o) });
  });
  // elements appear line by line — keep headings/cards below y=260
  if (o.i >= 4) chartCard(240, 470, 600, 300, [[0, .9], [.2, .7], [.4, .75], [.6, .4], [.8, .25], [1, .05]], '#76b900', 'shares +40%');
  if (rv(o, 6, 3)) quoteCard(['"the figures in the report', 'do not match the claims"'], rv(o, 6, 3), 560);
}

// Closing scene (lines 8–9): front-facing character + big text — the outro pattern
function scClosing(o) {
  cam(o, { z0: 1.045, z1: 1.095, cy: 1000, punch: .018, driftX: 4 }, () => {
    bgNight();
    tint('4,4,10', .3);
    person('host', { x: 540, y: 1680, scale: .9, t: o.t, look: 1, mood: 'resolute', blink: (o.t % 3.8) < .12 });
    rim(540, 1680, .9, 1, 'rgba(118,185,0,.35)');
  });
  const e = ease(o.p * 1.3);
  if (e) {
    g.globalAlpha = e;
    TXT('this story', 540, 400, 88, '#e8dede', 'center', 900);
    TXT('is not over', 540, 520, 88, '#e05252', 'center', 900);
    g.globalAlpha = 1;
  }
}

// ── Scene table rows: [first line of NEXT scene, scene fn] — sorted and always ending with Infinity ──
// scOpening covers lines 0–2 · scTalk covers 3–7 · scClosing covers 8–9
const SC = [[3, scOpening], [8, scTalk], [Infinity, scClosing]];
defineCharacters(CH);
defineScenes(SC);
setFootnote(FOOTNOTE_TEXT);
