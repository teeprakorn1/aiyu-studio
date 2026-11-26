/**
 * @file preview.test.mjs — preview.html transport/scrub/waveform verification via playwright.
 * Requires playwright-core resolvable from the scaffolded project.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(here, '..', '..');
const PROJ = path.join(here, '.tmp-preview');
const PY = process.env.PYTHON || 'py';
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(cmd, args, cwd = PROJ) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

let browser, page, errors;

before(async function () {
  rmSync(PROJ, { recursive: true, force: true });
  run(PY, [path.join(REPO, 'new-project.py'), PROJ], REPO);
  execFileSync(NPM, ['install', '--no-fund', '--no-audit', '--silent'], { cwd: PROJ, shell: true, stdio: 'ignore' });
  run(PY, ['engine/mix-studio.py', '--stub']);
  const require = createRequire(path.join(PROJ, 'package.json'));
  const { chromium } = require('playwright-core');
  for (const opts of [{ channel: 'chrome' }, {}, { channel: 'chromium' }]) {
    try { browser = await chromium.launch(opts); break; } catch { /* next flavor */ }
  }
  if (!browser) throw new Error('no browser available');
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(PROJ, 'preview.html')).href);
  await page.evaluate(() => window.ready);
});

after(async () => {
  if (browser) await browser.close();
  rmSync(PROJ, { recursive: true, force: true });
});

test('loads without page errors', () => {
  assert.deepEqual(errors, []);
});

test('seek updates time display and current line', async () => {
  await page.evaluate(() => seek(9.5));
  const time = await page.evaluate(() => document.getElementById('time').textContent);
  assert.match(time, /0:09\.5/);
  const info = await page.evaluate(() => document.getElementById('lineinfo').textContent);
  assert.ok(info.length > 3);
});

test('video canvas paints non-black content', async () => {
  const lit = await page.evaluate(() => {
    const cv = document.getElementById('c'), x = cv.getContext('2d');
    const d = x.getImageData(0, 0, 1080, 1920).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4000) if (d[i] + d[i + 1] + d[i + 2] > 60) n++;
    return n;
  });
  assert.ok(lit > 100, `canvas too dark: ${lit}`);
});

test('waveform layer painted on timeline', async () => {
  const lit = await page.evaluate(() => {
    const t = document.getElementById('tl'), x = t.getContext('2d');
    const d = x.getImageData(0, 0, t.width, t.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 997 * 4) if (d[i] + d[i + 1] + d[i + 2] > 80) n++;
    return n;
  });
  assert.ok(lit > 10, `waveform missing: ${lit}`);
});

test('click at 75% of timeline seeks to ~75% of duration', async () => {
  const box = await page.locator('#tl').boundingBox();
  await page.mouse.click(box.x + box.width * .75, box.y + box.height / 2);
  await page.waitForTimeout(200);
  const t = await page.evaluate(() => document.getElementById('time').textContent);
  const dur = await page.evaluate(() => TALK.dur);
  const secs = parseFloat(t.match(/0:(\d+\.\d)/)?.[1] ?? '0');
  assert.ok(Math.abs(secs - 0.75 * dur) < 1.0, `click seek off: ${secs} vs ${0.75 * dur}`);
});
