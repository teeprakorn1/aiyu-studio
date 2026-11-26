/**
 * @file determinism.test.mjs — enforces the Determinism Law of AGENTS.md:
 * render(t) must be a pure function of t. Same time, same pixels, always.
 * Also smoke-checks visual stability via golden stills with tolerant tolerant pixel comparison.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync, readFileSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, npmInstall, npmRun, PY } from '../helpers/proc.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(here, '..', '..');
const PROJ = path.join(here, '.tmp-determinism');
const GOLDENS = path.join(here, 'fixtures', 'golden');

async function compareJpegPair(fileA, fileB) {
  const require = createRequire(path.join(PROJ, 'package.json'));
  const { chromium } = require('playwright-core');
  let browser;
  for (const opts of [{ channel: 'chrome' }, {}, { channel: 'chromium' }]) {
    try { browser = await chromium.launch(opts); break; } catch { }
  }
  if (!browser) throw new Error('no browser available for image comparison');
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

const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');

before(function () {
  rmSync(PROJ, { recursive: true, force: true });
  run(PY, [path.join(REPO, 'new-project.py'), PROJ], REPO);
  npmInstall(PROJ);
  npmRun('stub', [], PROJ);
});

after(() => { rmSync(PROJ, { recursive: true, force: true }); });

test('rendering the same timestamp twice yields pixel-identical output', () => {
  run('node', ['engine/render.mjs', 'stills', '5'], PROJ);
  const first = path.join(PROJ, 'stills', 't5.000.jpg');
  const h1 = sha(first);
  // second render overwrites the same file — hashes must match exactly
  run('node', ['engine/render.mjs', 'stills', '5'], PROJ);
  const h2 = sha(first);
  assert.equal(h1, h2, 'DETERMINISM LAW VIOLATION: same t rendered different pixels — check for Math.random()/Date.now() in render paths');
});

test('different timestamps render different content (sanity)', () => {
  run('node', ['engine/render.mjs', 'stills', '2,8'], PROJ);
  const a = sha(path.join(PROJ, 'stills', 't2.000.jpg'));
  const b = sha(path.join(PROJ, 'stills', 't8.000.jpg'));
  assert.notEqual(a, b);
});

test('golden stills stay within tolerant pixel drift (visual regression smoke)', async (t) => {
  if (!existsSync(GOLDENS) || readdirSync(GOLDENS).length === 0) {
    mkdirSync(GOLDENS, { recursive: true });
    run('node', ['engine/render.mjs', 'stills', '2,5,8'], PROJ);
    for (const f of readdirSync(path.join(PROJ, 'stills')).filter(f => f.startsWith('t'))) {
      copyFileSync(path.join(PROJ, 'stills', f), path.join(GOLDENS, f));
    }
    t.skip('goldens initialized — rerun to compare');
    return;
  }
  run('node', ['engine/render.mjs', 'stills', '2,5,8'], PROJ);
  for (const g of readdirSync(GOLDENS)) {
    const metric = await compareJpegPair(path.join(PROJ, 'stills', g), path.join(GOLDENS, g));
    assert.ok(
      metric.meanDiff <= 8 && metric.changedFrac <= 0.15,
      `${g} pixel drift mean=${metric.meanDiff.toFixed(2)} changed=${(metric.changedFrac * 100).toFixed(1)}% — visual output changed; verify intentional, then refresh goldens`
    );
  }
});
