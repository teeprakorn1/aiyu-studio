/**
 * @file render.mjs — stills & video renderer (playwright-core + ffmpeg pipe)
 *
 * Usage (run from the project root):
 *   node engine/render.mjs stills 1,5,9,12            → stills/t*.jpg + sheet.jpg overview (no sheet for a single time)
 *   node engine/render.mjs … --page=index.html        → render another page (query strings allowed, e.g. index.html?x=1)
 *   node engine/render.mjs video [from,to] --out=name --crf=22 → out/name.mp4 (silent); range renders only that segment
 *
 * Flags --out / --page / --crf / --preset may also be set via env OUT / PAGE / CRF / PRESET.
 * Browser override: --browser=path or env CHROME_PATH. An existing video output is never overwritten unless --force is given.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, assertKnownFlags, strFlag } from './lib/cli-args.mjs';
import { resolvePlaywright, launchBrowser, awaitPageReady } from './lib/playwright-env.mjs';
import { validateX264 } from './lib/encoding.mjs';
import { parseStillTimes, parseVideoRange, outputNameFor } from './lib/render-spec.mjs';
import { resolveExecutable } from './lib/exec.mjs';
import { resolveInside } from './lib/paths.mjs';

/** project root — engine scripts always run from the project root (npm scripts guarantee it) */
const ROOT = process.cwd();
const FPS = 30;

async function renderStills(pg, times) {
  mkdirSync(path.join(ROOT, 'stills'), { recursive: true });
  const files = [];
  for (const t of times) {
    const f = path.join(ROOT, 'stills', `t${t.toFixed(3)}.jpg`);
    await pg.evaluate(t => window.render(t), t);
    await pg.screenshot({ path: f, type: 'jpeg', quality: 90 });
    files.push(f);
  }
  if (files.length < 2) {
    console.log('stills ok', files.length);
    return;
  }
  const cols = 3, rows = Math.ceil(files.length / cols);
  execFileSync(resolveExecutable('ffmpeg'), ['-y', '-loglevel', 'error', ...files.flatMap(f => ['-i', f]),
    '-filter_complex', files.map((_, i) => `[${i}]scale=320:-1[s${i}]`).join(';') + ';' + files.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${files.length}:layout=` +
    files.map((_, i) => `${(i % cols) * 320}_${Math.floor(i / cols) * 569}`).join('|') + (files.length < cols * rows ? ':fill=black' : ''),
    path.join(ROOT, 'stills', 'sheet.jpg')]);
  console.log('stills ok', files.length);
}

async function renderVideo(pg, { outFile, from, to, crf, preset }) {
  mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  let ffmpegErr = '';
  const ff = spawn(resolveExecutable('ffmpeg'), ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', crf, '-preset', preset, '-an', outFile], { stdio: ['pipe', 'inherit', 'pipe'] });
  ff.stderr.on('data', d => { ffmpegErr = (ffmpegErr + d.toString()).slice(-12000); });
  const n = Math.round((to - from) * FPS);
  let code;
  try {
    for (let i = 0; i < n; i++) {
      await pg.evaluate(t => window.render(t), from + i / FPS);
      const buf = await pg.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 90 === 0) console.log(`frame ${i}/${n}`);
    }
    ff.stdin.end();
    code = await new Promise(r => ff.on('close', r));
  } catch (err) {
    if (ff.exitCode === null && ff.signalCode === null) {
      ff.kill();
      await new Promise(r => ff.once('close', r));
    }
    rmSync(outFile, { force: true });
    throw err;
  }
  if (code !== 0) rmSync(outFile, { force: true });
  if (code !== 0) throw new Error(`ffmpeg exited with code ${code}\n${ffmpegErr.slice(-5000)}`);
  if (!existsSync(outFile) || !statSync(outFile).size) throw new Error(`ffmpeg completed but output missing/empty: ${outFile}`);
  console.log('video ok');
}

async function main() {
  const { flags, pos } = parseArgs(process.argv.slice(2));
  assertKnownFlags(flags, ['browser', 'page', 'out', 'crf', 'preset', 'force', 'help'], 'render.mjs');
  if (flags.help) {
    console.log('Usage: node engine/render.mjs stills 1,5,9 | video from,to [--page=index.html] [--out=name] [--crf=20] [--preset=medium] [--browser=path] [--force]');
    return;
  }
  const [mode = 'stills', arg = '1,5,9,12,15,19'] = pos;
  if (!['stills', 'video'].includes(mode)) throw new Error(`invalid mode '${mode}'; expected stills or video`);
  const outName = strFlag(flags, 'out', process.env.OUT || 'video');
  if (!outName || outName.includes('/') || outName.includes('\\')) throw new Error('--out must be a file-name prefix, not a path');
  const { crf, preset } = validateX264(strFlag(flags, 'crf', process.env.CRF || '20'), strFlag(flags, 'preset', process.env.PRESET || 'medium'));
  const stillTimes = mode === 'stills' ? parseStillTimes(arg) : null;
  const explicitRange = mode === 'video' && pos[1] !== undefined ? parseVideoRange(pos[1]) : null;
  const outFile = path.join(ROOT, 'out', outputNameFor(outName, mode === 'video' ? pos[1] : undefined));
  if (mode === 'video' && existsSync(outFile) && flags.force === undefined) {
    throw new Error(`${path.relative(ROOT, outFile)} already exists — choose a new --out prefix (rendered versions are never overwritten) or pass --force`);
  }
  const page = strFlag(flags, 'page', process.env.PAGE || 'index.html');
  const [pageFile, query] = page.split('?');
  resolveInside(ROOT, pageFile);
  const browser = await launchBrowser(resolvePlaywright(ROOT), strFlag(flags, 'browser', process.env.CHROME_PATH));
  try {
    const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const pageErrors = [];
    pg.on('pageerror', e => { pageErrors.push(e.message); console.error('PAGE ERROR', e.message); });
    await pg.goto(pathToFileURL(path.join(ROOT, pageFile)).href + (query ? '?' + query : ''));
    await awaitPageReady(pg);
    if (pageErrors.length) throw new Error(`page script errors: ${pageErrors.join(' | ')}`);
    const vs = await pg.evaluate(() => ({ width: document.getElementById('c').width, height: document.getElementById('c').height }));
    if (vs.width !== 1920 || vs.height !== 1080) await pg.setViewportSize(vs);
    if (mode === 'stills') {
      await renderStills(pg, stillTimes);
    } else {
      const total = await pg.evaluate(() => window.DURATION);
      const [from, to] = explicitRange || [0, total];
      await renderVideo(pg, { outFile, from, to, crf, preset });
    }
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});
