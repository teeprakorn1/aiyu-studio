/**
 * @file determinism.test.mjs — enforces the Determinism Law of AGENTS.md: render(t) is a pure function of t.
 * Same time, same pixels, in any process and any frame set. Visual regression compares committed golden stills;
 * missing goldens fail unless AIYU_WRITE_GOLDENS=1 initializes them after an intentional visual change.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync, readFileSync, readdirSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, npmInstall, npmRun, PY } from '../helpers/proc.mjs';
import { launchBrowser, resolvePlaywright } from '../../engine/lib/playwright-env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(here, '..', '..');
const PROJ = path.join(here, '.tmp-determinism');
const GOLDENS = path.join(here, 'fixtures', 'golden');
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');
const render = (...args) => run(process.execPath, ['engine/render.mjs', ...args], PROJ);
const still = t => path.join(PROJ, 'stills', `t${t.toFixed(3)}.jpg`);

async function compareJpegPair(fileA, fileB) {
  const browser = await launchBrowser(resolvePlaywright(PROJ));
  try {
    const page = await browser.newPage();
    const a = readFileSync(fileA).toString('base64'), b = readFileSync(fileB).toString('base64');
    return await page.evaluate(async ({ a, b }) => {
      const load = data => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = 'data:image/jpeg;base64,' + data;
      });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { meanDiff: 999, changedFrac: 1, widthA: ia.width, widthB: ib.width };
      const cv = document.createElement('canvas');
      cv.width = ia.width; cv.height = ia.height;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(ia, 0, 0);
      const da = cx.getImageData(0, 0, cv.width, cv.height).data;
      cx.clearRect(0, 0, cv.width, cv.height);
      cx.drawImage(ib, 0, 0);
      const db = cx.getImageData(0, 0, cv.width, cv.height).data;
      let sum = 0, changed = 0, count = 0;
      for (let i = 0; i < da.length; i += 16) { // every fourth pixel, RGB channels
        const d = (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3;
        sum += d; count++;
        if (d > 8) changed++;
      }
      return { meanDiff: sum / count, changedFrac: changed / count };
    }, { a, b });
  } finally {
    await browser.close();
  }
}

const FIXTURE_STYLE = `definePeople({ walker: { skin: '#B97B50', skinShade: '#9A6340', hair: '#211B18', cloth: '#8F3F34', sash: '#D6A03D', hairStyle: 'topknot' } });
defineCharacters({ host: { skin: '#d9a06e', hair: '#7d8087', top: '#1c1c20', bot: '#25262c', hs: 'jensen', jacket: true } });
SUB_KARAOKE = true;
const GLOBE_FIX = { cx: 540, cy: 640, r: 330, spin: .18, face: [13.7, 100.5] };
function scA(o) {
  cam(o, { z0: 1.03, z1: 1.09, cy: 980, punch: .014, driftX: 4 }, () => {
    skyStops([[0, '#151B2F'], [.42, '#342D45'], [.68, '#87513C'], [.82, '#D99154']], 0, 1240);
    hillsLayer(1162, 130, 3, mixHex('#2A1E16', '#87513C', .72));
    waterBody(1244, '#243846', '#0B1720');
    ripples(1256, 1620, o.t, 5);
    motes(12, 400, 1200, o.t, 7);
    dotGlobe(GLOBE_FIX, o.t, { land: '#e8d9b0', ocean: .1, glow: '216,190,140' });
    globeArc(GLOBE_FIX, o.t, [13.75, 100.5], [35.68, 139.69], rv(o, 1), { color: '#e8a24a' });
    globeMark(GLOBE_FIX, o.t, [35.68, 139.69], rv(o, 1), { color: '#ffd166' });
    personTH('walker', { x: 540, y: 1560, scale: .9, t: o.t, walk: true, walkSpeed: 1.6, mouth: mouthFor('M', o) });
  });
  sketchArrow(200, 700, 500, 900, { seed: 9001, rough: 1.2, boil: 3, t: o.t });
  captionScrim(.5);
}
function scB(o) {
  cam(o, { z0: 1.04, z1: 1.09, cy: 1000, punch: .02, driftX: 4 }, () => {
    wall('#101623', '#05070d');
    rain(.07, 20, o.t);
    person('host', { x: 540, y: 1600, scale: 1, t: o.t, look: 1, mouth: mouthFor('H', o) });
  });
  captionScrim(.5);
}
defineScenes([[1, scA], [Infinity, scB]]);
setFootnote('determinism fixture');
`;

function writeFixture() {
  writeFileSync(path.join(PROJ, 'story', 'style.js'), FIXTURE_STYLE);
  const env = Array.from({ length: 30 }, (_, i) => +(0.2 + 0.6 * Math.abs(Math.sin(i / 3))).toFixed(3));
  const talk = { dur: 4, lines: [
    { i: 0, spk: 'M', t0: 0, dur: 2, txt: 'สวัสดีครับ hello world', env, words: [{ w: 'สวัสดีครับ', t0: 0.2, dur: 0.8 }, { w: 'hello', t0: 1.2, dur: 0.6 }] },
    { i: 1, spk: 'H', t0: 2, dur: 2, txt: 'ทดสอบ karaoke', env, words: [{ w: 'ทดสอบ', t0: 2.2, dur: 0.7 }, { w: 'karaoke', t0: 3.0, dur: 0.8 }] },
  ], wave: [], waveDur: 4 };
  writeFileSync(path.join(PROJ, 'talk.js'), 'const TALK=' + JSON.stringify(talk) + ';\n');
}

before(function () {
  rmSync(PROJ, { recursive: true, force: true });
  run(PY, [path.join(REPO, 'new-project.py'), PROJ], REPO);
  npmInstall(PROJ);
  npmRun('stub', [], PROJ);
});

after(() => { if (!process.env.AIYU_KEEP_WORKSPACES) rmSync(PROJ, { recursive: true, force: true }); });

test('rendering the same timestamp twice yields pixel-identical output', () => {
  render('stills', '5');
  const first = sha(still(5));
  render('stills', '5');
  assert.equal(sha(still(5)), first, 'DETERMINISM LAW VIOLATION: same t rendered different pixels — check for Math.random()/Date.now() in render paths');
});

test('a frame does not depend on the frames rendered before it (no hidden render state)', () => {
  render('stills', '1.5,3');
  const inSet = sha(still(3));
  render('stills', '3');
  assert.equal(sha(still(3)), inSet, 'frame depends on previously rendered frames');
});

test('different timestamps render different content (sanity)', () => {
  render('stills', '2,8');
  assert.notEqual(sha(still(2)), sha(still(8)));
});

test('golden stills stay within tolerant pixel drift (visual regression smoke)', async () => {
  const have = existsSync(GOLDENS) && readdirSync(GOLDENS).some(f => f.endsWith('.jpg'));
  const write = process.env.AIYU_WRITE_GOLDENS === '1';
  if (!have && !write) {
    assert.fail(`no golden stills in ${path.relative(REPO, GOLDENS)} — restore them from git, or run with AIYU_WRITE_GOLDENS=1 to write them after an intentional visual change`);
  }
  render('stills', '2,5,8');
  mkdirSync(GOLDENS, { recursive: true });
  if (write) {
    for (const f of ['t2.000.jpg', 't5.000.jpg', 't8.000.jpg']) copyFileSync(path.join(PROJ, 'stills', f), path.join(GOLDENS, f));
    return;
  }
  for (const g of readdirSync(GOLDENS)) {
    const metric = await compareJpegPair(path.join(PROJ, 'stills', g), path.join(GOLDENS, g));
    assert.ok(
      metric.meanDiff <= 8 && metric.changedFrac <= 0.15,
      `${g} pixel drift mean=${metric.meanDiff.toFixed(2)} changed=${(metric.changedFrac * 100).toFixed(1)}% — visual output changed; verify intentional, then refresh goldens with AIYU_WRITE_GOLDENS=1`
    );
  }
});

test('optional modules, sketch annotations, and karaoke render identically across processes and frame sets', () => {
  writeFixture();
  render('stills', '1.5,3.5');
  const first = { a: sha(still(1.5)), b: sha(still(3.5)) };
  render('stills', '1.5,3.5');
  assert.equal(sha(still(1.5)), first.a, 'optional-module frame differs across processes');
  assert.equal(sha(still(3.5)), first.b, 'karaoke frame differs across processes');
  render('stills', '3.5');
  assert.equal(sha(still(3.5)), first.b, 'frame differs when rendered alone');
});
