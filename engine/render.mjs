/**
 * @file render.mjs — stills & video renderer (playwright-core + ffmpeg pipe)
 *
 * Usage (run from the project root):
 *   node engine/render.mjs stills 1,5,9,12            → stills/t*.jpg + sheet.jpg overview (no sheet for a single time)
 *   node engine/render.mjs … --page=index.html        → render another page (query strings allowed, e.g. index.html?x=1)
 *   node engine/render.mjs video [from,to] --out=name --crf=22 → out/name.mp4 (silent); range renders only that segment
 *
 * Flags --out / --page / --crf / --preset may also be set via env OUT / PAGE / CRF / PRESET.
 * Browser override: --browser=path or env CHROME_PATH.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, assertKnownFlags } from './lib/cli-args.mjs';
import { resolvePlaywright, launchBrowser, awaitPageReady } from './lib/playwright-env.mjs';
import { validateX264 } from './lib/encoding.mjs';

/** project root — engine scripts always run from the project root (npm scripts guarantee it) */
const ROOT = process.cwd();
const { flags, pos } = parseArgs(process.argv.slice(2));
assertKnownFlags(flags, ['browser','page','out','crf','preset','help'], 'render.mjs');
if (flags.help) {
  console.log('Usage: node engine/render.mjs stills 1,5,9 | video from,to [--page=index.html] [--out=name] [--crf=20] [--preset=medium] [--browser=path]');
  process.exit(0);
}
const [mode = 'stills', arg = '1,5,9,12,15,19'] = pos;
if (!['stills', 'video'].includes(mode)) throw new Error(`invalid mode '${mode}'; expected stills or video`);
const OUTNAME0 = flags.out || process.env.OUT || 'video';
if (!OUTNAME0 || OUTNAME0.includes('/') || OUTNAME0.includes('\\')) throw new Error('--out must be a file-name prefix, not a path');
const { crf, preset } = validateX264(flags.crf || process.env.CRF || '20', flags.preset || process.env.PRESET || 'medium');

// Validate user-supplied time specifications before paying browser startup cost.
function parseStillTimes(raw) {
  const parts = String(raw).split(',');
  if (!String(raw).trim() || parts.some(x => !x.trim() || !Number.isFinite(Number(x)) || Number(x) < 0)) throw new Error(`invalid still timestamps: ${raw}`);
  return parts.map(Number);
}
function parseVideoRange(raw) {
  const parts = String(raw).split(',');
  const [from, to] = parts.map(Number);
  if (parts.length !== 2 || parts.some(x => !x.trim()) || !Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= from) throw new Error(`invalid video range: ${raw}`);
  return [from, to];
}
const stillTimes = mode === 'stills' ? parseStillTimes(arg) : null;
const explicitRange = mode === 'video' && pos[1] !== undefined ? parseVideoRange(pos[1]) : null;

const FPS = 30;
const chromium = resolvePlaywright(ROOT);

const browser = await launchBrowser(chromium, flags.browser || process.env.CHROME_PATH);
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const PAGE = flags.page || process.env.PAGE || 'index.html';
const OUTNAME = OUTNAME0;
const [pageFile, query] = PAGE.split('?');
const pageErrors = [];
page.on('pageerror', e => { pageErrors.push(e.message); console.error('PAGE ERROR', e.message); });
await page.goto(pathToFileURL(path.join(ROOT, pageFile)).href + (query ? '?' + query : ''));
await awaitPageReady(page);
if (pageErrors.length) throw new Error(`page script errors: ${pageErrors.join(' | ')}`);
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
  const ts = stillTimes;
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
  const [from, to] = explicitRange || [0, total];
  let ffmpegErr = '';
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', crf, '-preset', preset, '-an',
    path.join(ROOT, 'out', clip ? `${OUTNAME}_${clip.replace(',', '-')}.mp4` : OUTNAME + '.mp4')], { stdio: ['pipe', 'inherit', 'pipe'] });
  ff.stderr.on('data', d => { ffmpegErr = (ffmpegErr + d.toString()).slice(-12000); });
  const n = Math.round((to - from) * FPS);
  for (let i = 0; i < n; i++) {
    const buf = await shot(from + i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 90 === 0) console.log(`frame ${i}/${n}`);
  }
  ff.stdin.end();
  const code = await new Promise(r => ff.on('close', r));
  const outFile = path.join(ROOT, 'out', clip ? `${OUTNAME}_${clip.replace(',', '-')}.mp4` : OUTNAME + '.mp4');
  if (code !== 0) throw new Error(`ffmpeg exited with code ${code}
${ffmpegErr.slice(-5000)}`);
  if (!existsSync(outFile) || !statSync(outFile).size) throw new Error(`ffmpeg completed but output missing/empty: ${outFile}`);
  console.log('video ok');
}
await browser.close();
