import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [process.env.PW_PKG, path.join(here, 'package.json')].filter(Boolean);
const pwPkg = candidates.find(p => existsSync(p.replace(/package\.json$/, 'node_modules/playwright-core')));
if (!pwPkg) {
  console.error('playwright-core not found; set PW_PKG to a package.json with playwright-core installed');
  process.exit(1);
}
const require = createRequire(pwPkg);
const { chromium } = require('playwright-core');

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
let pageError = '';
page.on('pageerror', e => { pageError = e.message; console.error('PAGE ERROR', e.message); });
await page.goto(pathToFileURL(path.join(here, process.argv[2] ?? 'index.html')).href);
await page.evaluate(() => window.ready);

const rows = await page.evaluate(() => TALK.lines.map(line => {
  const lay = layoutSubs(line.txt);
  return {
    i: line.i,
    txt: line.txt,
    rows: lay.rows,
    rowCount: lay.rows.length,
    fontSize: lay.size,
    textWidth: Math.round(lay.maxWidth * 10) / 10,
    frameWidth: Math.round(lay.frameWidth * 10) / 10,
    overflow: !!lay.overflow || lay.frameWidth > 980,
  };
}));
await browser.close();

rows.sort((a, b) => b.frameWidth - a.frameWidth);
console.log('line\trows\tfont\ttext_px\tframe_px\twidth_preview');
for (const r of rows.slice(0, 10)) {
  console.log(`${r.i}\t${r.rowCount}\t${r.fontSize}\t${r.textWidth}\t${r.frameWidth}\t${r.rows.join(' / ')}`);
}
const failed = rows.filter(r => r.overflow);
const max = rows[0];
console.log(`\nchecked=${rows.length} maxFrame=${max.frameWidth}px line=${max.i} failures=${failed.length}`);
if (failed.length) {
  console.error('overflow lines: ' + failed.map(r => `${r.i}:${r.frameWidth}px`).join(', '));
  process.exit(2);
}
if (pageError) process.exit(3);
console.log('subtitle width acceptance: PASS');
