/**
 * @file preview.test.mjs — preview.html transport/scrub/waveform verification via playwright.
 * Requires playwright-core resolvable from the scaffolded project.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, npmInstall, npmRun, PY } from '../helpers/proc.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(here, '..', '..');
const PROJ = path.join(here, '.tmp-preview');

let browser, page, errors;

before(async function () {
  rmSync(PROJ, { recursive: true, force: true });
  run(PY, [path.join(REPO, 'new-project.py'), PROJ], REPO);
  npmInstall(PROJ);
  npmRun('stub', [], PROJ);
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


test('optional atmosphere and people modules execute real drawing paths', async () => {
  const lit = await page.evaluate(() => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    skyStops([[0, '#182638'], [.6, '#5d4a38'], [1, '#151820']]);
    waterBody(1220, '#263c48', '#091018');
    ripples(1240, 1650, 2.5);
    personTH('merchant', { x: 540, y: 1500, scale: .65, t: 2, walk: true, look: 1 });
    grainLayer(.02);
    const d = g.getImageData(0, 0, W, H).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4000) if (d[i] + d[i + 1] + d[i + 2] > 60) n++;
    render(0);
    return n;
  });
  assert.ok(lit > 100, `optional module scene too dark: ${lit}`);
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

const clockSecs = async () => {
  const t = await page.evaluate(() => document.getElementById('time').textContent);
  const m = t.match(/(\d+):(\d+\.\d)/);
  return m ? +m[1] * 60 + +m[2] : -1;
};

test('A-B loop marks appear in transport and loop wraps playback', async () => {
  await page.evaluate(() => { seek(2); });
  await page.keyboard.press('[');
  await page.evaluate(() => { seek(5); });
  await page.keyboard.press(']');
  const info = await page.evaluate(() => document.getElementById('loopinfo').textContent);
  assert.match(info, /A 0:02\.0/, `loop A missing: ${info}`);
  assert.match(info, /B 0:05\.0/, `loop B missing: ${info}`);
  // play in clock mode from just before B — playback must wrap back near A, never run past B for long
  await page.evaluate(() => { seek(4.9); setPlaying(true); });
  await page.waitForTimeout(700);
  await page.evaluate(() => setPlaying(false));
  const secs = await clockSecs();
  assert.ok(secs >= 1.9 && secs < 4.5, `loop did not wrap — clock at ${secs}s (expected back near 2s)`);
  // clear the loop — marks gone, state resets
  await page.keyboard.press('\\');
  const cleared = await page.evaluate(() => document.getElementById('loopinfo').textContent);
  assert.equal(cleared, '');
});

test('scene jump menu lists scenes and seeks to their first line', async () => {
  const count = await page.evaluate(() => document.getElementById('scenejump').options.length);
  assert.ok(count >= 3, `scene menu too thin: ${count} options`);
  const target = await page.evaluate(() => TALK.lines[3].t0);
  await page.selectOption('#scenejump', '3');
  await page.waitForTimeout(150);
  const secs = await clockSecs();
  assert.ok(Math.abs(secs - target) < .3, `scene jump off: ${secs} vs ${target}`);
  // selector resets to the placeholder after jumping
  const val = await page.evaluate(() => document.getElementById('scenejump').value);
  assert.equal(val, '');
});

test('no page errors after transport interactions', () => {
  assert.deepEqual(errors, []);
});
