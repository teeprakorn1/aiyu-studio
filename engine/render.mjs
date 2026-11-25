/**
 * @file render.mjs — stills & video renderer (playwright-core + ffmpeg pipe)
 *
 * Usage:
 *   node render.mjs stills 1,5,9,12            → stills/t*.jpg + sheet.jpg overview (no sheet for a single time)
 *   node render.mjs … --page=index.html        → render another page (query strings allowed, e.g. index.html?x=1)
 *   node render.mjs video [from,to] --out=name --crf=22 → out/name.mp4 (silent); range renders only that segment
 *
 * Flags --out / --page / --crf may also be set via env OUT / PAGE / CRF.
 * playwright-core resolves from the project's own node_modules (npm install),
 * or from env PW_PKG pointing to a package.json whose sibling node_modules has it.
 */
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// playwright-core: prefer PW_PKG env, fall back to project node_modules
const PW_CANDIDATES = [process.env.PW_PKG, path.join(here, 'package.json')].filter(Boolean);
const pwPkg = PW_CANDIDATES.find(p => existsSync(p.replace(/package\.json$/, 'node_modules/playwright-core')));
if (!pwPkg) { console.error('playwright-core not found: run npm install in the project folder (or set env PW_PKG to a package.json that has playwright-core installed)'); process.exit(1); }
const require = createRequire(pwPkg);
const { chromium } = require('playwright-core');

const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const [mode = 'stills', arg = '1,5,9,12,15,19'] = args;
const FPS = 30;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const PAGE = flags.page || process.env.PAGE || 'index.html';
const OUTNAME = flags.out || process.env.OUT || '成片';
const [pageFile, query] = PAGE.split('?');
await page.goto(pathToFileURL(path.join(here, pageFile)).href + (query ? '?' + query : ''));
page.on('pageerror', e => console.error('PAGE ERROR', e.message));
await page.evaluate(() => window.ready);
const vs = await page.evaluate(() => ({ width: document.getElementById('c').width, height: document.getElementById('c').height }));
if (vs.width !== 1920 || vs.height !== 1080) await page.setViewportSize(vs);
import { writeFileSync } from 'node:fs';
mkdirSync(path.join(here, 'out'), { recursive: true });
writeFileSync(path.join(here, 'out', 'cues.json'), JSON.stringify(await page.evaluate(() => ({ dur: window.DURATION, cues: window.CUES || [] }))));
const shot = async t => { await page.evaluate(t => window.render(t), t); return page.screenshot({ type: 'jpeg', quality: 92 }); };

if (mode === 'stills') {
  mkdirSync(path.join(here, 'stills'), { recursive: true });
  const ts = arg.split(',').map(Number);
  const files = [];
  for (const t of ts) {
    const f = path.join(here, 'stills', `t${t.toFixed(3)}.jpg`);
    await page.evaluate(t => window.render(t), t);
    await page.screenshot({ path: f, type: 'jpeg', quality: 90 });
    files.push(f);
  }
  if (files.length < 2) { console.log('stills ok', files.length); await browser.close(); process.exit(0); }
  const cols = 3, rows = Math.ceil(files.length / cols);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...files.flatMap(f => ['-i', f]),
    '-filter_complex', files.map((_, i) => `[${i}]scale=320:-1[s${i}]`).join(';') + ';' + files.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${files.length}:layout=` +
    files.map((_, i) => `${(i % cols) * 320}_${Math.floor(i / cols) * 569}`).join('|') + (files.length < cols * rows ? ':fill=black' : ''),
    path.join(here, 'stills', 'sheet.jpg')]);
  console.log('stills ok', files.length);
} else {
  mkdirSync(path.join(here, 'out'), { recursive: true });
  const clip = args[1];
  const total = await page.evaluate(() => window.DURATION);
  const [from, to] = clip ? clip.split(',').map(Number) : [0, total];
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', flags.crf || process.env.CRF || '20', '-preset', 'medium', '-an',
    path.join(here, 'out', clip ? `${OUTNAME}_${clip.replace(',', '-')}.mp4` : OUTNAME + '.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round((to - from) * FPS);
  for (let i = 0; i < n; i++) {
    const buf = await shot(from + i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 90 === 0) console.log(`frame ${i}/${n}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('video ok');
}
await browser.close();