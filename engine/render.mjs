/**
 * @file render.mjs — stills & video renderer (playwright-core + ffmpeg pipe)
 *
 * Usage (run from the project root):
 *   node engine/render.mjs stills 1,5,9,12            → stills/t*.jpg + sheet.jpg overview (no sheet for a single time)
 *   node engine/render.mjs … --page=index.html        → render another page (query strings allowed, e.g. index.html?x=1)
 *   node engine/render.mjs video [from,to] --out=name --crf=22 → out/name.mp4 (silent); range renders only that segment
 *
 * Flags --out / --page / --crf may also be set via env OUT / PAGE / CRF.
 * Browser override: --browser=path or env CHROME_PATH.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from './lib/cli-args.mjs';
import { resolvePlaywright, launchBrowser } from './lib/playwright-env.mjs';

/** project root — engine scripts always run from the project root (npm scripts guarantee it) */
const ROOT = process.cwd();
const chromium = resolvePlaywright(ROOT);

const { flags, pos } = parseArgs(process.argv.slice(2));
const [mode = 'stills', arg = '1,5,9,12,15,19'] = pos;
const FPS = 30;

const browser = await launchBrowser(chromium, flags.browser || process.env.CHROME_PATH);
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const PAGE = flags.page || process.env.PAGE || 'index.html';
const OUTNAME = flags.out || process.env.OUT || 'video';
const [pageFile, query] = PAGE.split('?');
page.on('pageerror', e => console.error('PAGE ERROR', e.message));
await page.goto(pathToFileURL(path.join(ROOT, pageFile)).href + (query ? '?' + query : ''));
await page.evaluate(() => window.ready);
const vs = await page.evaluate(() => ({ width: document.getElementById('c').width, height: document.getElementById('c').height }));
if (vs.width !== 1920 || vs.height !== 1080) await page.setViewportSize(vs);
mkdirSync(path.join(ROOT, 'out'), { recursive: true });
writeFileSync(path.join(ROOT, 'out', 'cues.json'), JSON.stringify(await page.evaluate(() => ({ dur: window.DURATION, cues: window.CUES || [] }))));

/**
 * Render one frame at time t and return it as a JPEG buffer.
 *
 * @param {number} t - timeline seconds
 * @returns {Promise<Buffer>} jpeg frame
 */
const shot = async t => { await page.evaluate(t => window.render(t), t); return page.screenshot({ type: 'jpeg', quality: 92 }); };

if (mode === 'stills') {
  mkdirSync(path.join(ROOT, 'stills'), { recursive: true });
  const ts = arg.split(',').map(Number);
  const files = [];
  for (const t of ts) {
    const f = path.join(ROOT, 'stills', `t${t.toFixed(3)}.jpg`);
    await page.evaluate(t => window.render(t), t);
    await page.screenshot({ path: f, type: 'jpeg', quality: 90 });
    files.push(f);
  }
  if (files.length < 2) { console.log('stills ok', files.length); await browser.close(); process.exit(0); }
  const cols = 3, rows = Math.ceil(files.length / cols);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...files.flatMap(f => ['-i', f]),
    '-filter_complex', files.map((_, i) => `[${i}]scale=320:-1[s${i}]`).join(';') + ';' + files.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${files.length}:layout=` +
    files.map((_, i) => `${(i % cols) * 320}_${Math.floor(i / cols) * 569}`).join('|') + (files.length < cols * rows ? ':fill=black' : ''),
    path.join(ROOT, 'stills', 'sheet.jpg')]);
  console.log('stills ok', files.length);
} else {
  mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  const clip = pos[1];
  const total = await page.evaluate(() => window.DURATION);
  const [from, to] = clip ? clip.split(',').map(Number) : [0, total];
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', flags.crf || process.env.CRF || '20', '-preset', 'medium', '-an',
    path.join(ROOT, 'out', clip ? `${OUTNAME}_${clip.replace(',', '-')}.mp4` : OUTNAME + '.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
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
