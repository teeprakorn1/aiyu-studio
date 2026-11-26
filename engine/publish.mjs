#!/usr/bin/env node
/**
 * @file publish.mjs — parallel chunk render driver.
 * Splits the timeline into contiguous whole-second chunks and renders them
 * concurrently through render.mjs, then writes the ffmpeg concat list.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { parseArgs, assertKnownFlags } from './lib/cli-args.mjs';
import { readTalk } from './lib/talk.mjs';
import { makeBoundaries, escapeConcatPath } from './lib/chunking.mjs';
import { validateX264 } from './lib/encoding.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
/** project root — engine scripts always run from the project root (npm scripts guarantee it) */
const ROOT = process.cwd();
const FPS = 30;

function usage() {
  console.log(`Usage: node publish.mjs [options]

Options:
  --duration=<sec>        Timeline end override in seconds (default: ceil(TALK.dur); ceiled to whole seconds)
  --chunks=6              Number of parallel chunks/renderer processes
  --page=index.html       Page passed through to render.mjs
  --browser=path          Chrome/Chromium binary passed through to render.mjs (env CHROME_PATH also propagates to all chunks)
  --out=v1                Output prefix; chunk files are out/<out>_<from>-<to>.mp4
  --list=<path>           Concat list output path (default out/<out>concat.txt)
  --pw-pkg=<path>         package.json whose sibling node_modules has playwright-core
  --baseline-fps=<fps>    Optional single-process baseline for true scaling/speedup report
  --crf=20                x264 CRF passed through to every chunk
  --preset=medium         x264 preset passed through to every chunk
  --dry-run               Print chunk commands without rendering
  --help                  Show this help

Example:
  node engine/publish.mjs --duration=95 --chunks=6 --page=index.html --out=v1
`);
}

function fmtSec(s) {
  return `${s.toFixed(2)}s`;
}

function attachPrefixedLines(stream, label, sink) {
  let rest = '';
  stream.on('data', d => {
    const text = d.toString();
    sink.buffer += text;
    if (sink.buffer.length > 12000) sink.buffer = sink.buffer.slice(-12000);
    rest += text;
    const lines = rest.split(/\r?\n/);
    rest = lines.pop() || '';
    for (const line of lines) {
      if (line.trim()) console.log(`${label} ${line}`);
    }
  });
  stream.on('end', () => {
    if (rest.trim()) console.log(`${label} ${rest}`);
  });
}

const { flags } = parseArgs(process.argv.slice(2));
assertKnownFlags(flags, ['duration','chunks','page','browser','out','list','pw-pkg','baseline-fps','dry-run','help','crf','preset'], 'publish.mjs');
if (flags.help) {
  usage();
  process.exit(0);
}

const durationArg = flags.duration === undefined ? readTalk(path.join(ROOT, 'talk.js')).dur : Number(flags.duration);
const end = Math.ceil(durationArg);
const chunks = Number(flags.chunks ?? 6);
const page = String(flags.page ?? 'index.html');
const outPrefix = String(flags.out ?? 'v1');
const listPath = path.resolve(ROOT, String(flags.list ?? path.join('out', outPrefix + 'concat.txt')));
const pwPkg = String(flags['pw-pkg'] ?? process.env.PW_PKG ?? path.join(ROOT, 'package.json'));
const renderScript = path.join(here, 'render.mjs');

if (!Number.isFinite(durationArg) || durationArg <= 0) throw new Error(`Invalid --duration: ${flags.duration ?? 'missing talk.js'}`);
if (!Number.isFinite(end) || end < chunks) throw new Error(`Need at least one whole second per chunk (end=${end}, chunks=${chunks})`);
if (!outPrefix || outPrefix.includes('/') || outPrefix.includes('\\')) throw new Error('--out must be a file-name prefix, not a path');
if (!existsSync(renderScript)) throw new Error(`render.mjs not found at ${renderScript}`);
if (!existsSync(pwPkg)) throw new Error(`playwright package.json not found: ${pwPkg}`);

if (!Number.isInteger(chunks) || chunks < 1) throw new Error(`Invalid --chunks: ${flags.chunks}`);
const encoding = validateX264(flags.crf ?? 20, flags.preset ?? 'medium');
const bounds = makeBoundaries(end, chunks);
const jobs = [];
for (let k = 0; k < chunks; k++) {
  const from = bounds[k];
  const to = bounds[k + 1];
  const range = `${from},${to}`;
  const fileRange = `${from}-${to}`;
  const output = path.join(ROOT, 'out', `${outPrefix}_${fileRange}.mp4`);
  jobs.push({
    index: k,
    from,
    to,
    range,
    output,
    relOutput: path.relative(ROOT, output).replaceAll('\\', '/'),
    frames: Math.round((to - from) * FPS),
    args: [renderScript, 'video', range, `--page=${page}`, `--out=${outPrefix}`, ...(flags.browser ? [`--browser=${flags.browser}`] : []), `--crf=${encoding.crf}`, `--preset=${encoding.preset}`],
  });
}

console.log(`publish: ${chunks} parallel chunks, 0-${end}s, page=${page}, out=${outPrefix}`);
console.log(`publish: machine reports ${os.cpus().length} logical CPUs; PW_PKG=${pwPkg}`);
console.log(`publish: chunks: ${jobs.map(j => `[${j.from}-${j.to}]`).join(' ')}`);

if (flags['dry-run']) {
  for (const j of jobs) console.log(`dry-run chunk ${j.index}: node ${j.args.map(a => JSON.stringify(a)).join(' ')}`);
  process.exit(0);
}

const startedAll = Date.now();
const results = await Promise.all(jobs.map(job => new Promise(resolve => {
  const started = Date.now();
  const env = { ...process.env, PW_PKG: pwPkg };
  const child = spawn(process.execPath, job.args, { cwd: ROOT, env, windowsHide: true });
  const stdoutSink = { buffer: '' };
  const stderrSink = { buffer: '' };
  attachPrefixedLines(child.stdout, `[c${job.index}]`, stdoutSink);
  attachPrefixedLines(child.stderr, `[c${job.index}!]`, stderrSink);
  child.on('error', err => resolve({ job, code: -1, wall: (Date.now() - started) / 1000, error: err, stdout: stdoutSink.buffer, stderr: stderrSink.buffer }));
  child.on('close', code => resolve({ job, code, wall: (Date.now() - started) / 1000, stdout: stdoutSink.buffer, stderr: stderrSink.buffer }));
})));
const parallelWall = (Date.now() - startedAll) / 1000;

let failed = false;
let serialWall = 0;
let totalFrames = 0;
console.log('\npublish chunk timing:');
for (const r of results) {
  const { job } = r;
  serialWall += r.wall;
  totalFrames += job.frames;
  const fps = job.frames / r.wall;
  const exists = existsSync(job.output);
  const size = exists ? statSync(job.output).size : 0;
  const ok = r.code === 0 && exists && size > 0;
  console.log(`  chunk ${r.job.index}: ${job.from}-${job.to}s  wall=${fmtSec(r.wall)}  frames=${job.frames}  fps=${fps.toFixed(2)}  file=${job.relOutput}  size=${size}  ${ok ? 'OK' : 'FAIL'}`);
  if (!ok) {
    failed = true;
    console.error(`  chunk ${r.job.index} failure details: exit=${r.code}${r.error ? ' spawnError=' + r.error.message : ''}`);
    if (r.stderr) console.error(`  stderr tail:\n${r.stderr.slice(-2500)}`);
    if (r.stdout) console.error(`  stdout tail:\n${r.stdout.slice(-1500)}`);
  }
}

if (failed) {
  console.error('publish: one or more chunks failed; concat list was not written');
  process.exit(1);
}

mkdirSync(path.dirname(listPath), { recursive: true });
const listDir = path.dirname(listPath);
const lines = results.map(({ job }) => {
  const rel = path.relative(listDir, job.output).replaceAll('\\', '/');
  return `file '${escapeConcatPath(rel)}'`;
});
writeFileSync(listPath, lines.join('\n') + '\n', 'utf8');

const aggregateFps = totalFrames / parallelWall;
const meanPerProcessFps = results.reduce((a, r) => a + r.job.frames / r.wall, 0) / results.length;
console.log('\npublish summary:');
console.log(`  parallel wall time: ${fmtSec(parallelWall)}`);
console.log(`  sum of chunk times under parallel load: ${fmtSec(serialWall)}`);
console.log(`  process overlap efficiency: ${(serialWall / (chunks * parallelWall) * 100).toFixed(1)}% (not serial speedup)`);
console.log(`  aggregate throughput: ${aggregateFps.toFixed(2)} frames/s`);
console.log(`  mean per-process throughput: ${meanPerProcessFps.toFixed(2)} frames/s`);
const baselineFps = Number(flags['baseline-fps']);
if (Number.isFinite(baselineFps) && baselineFps > 0) {
  const speedup = aggregateFps / baselineFps;
  console.log(`  speedup vs supplied ${baselineFps.toFixed(2)} fps serial baseline: ${speedup.toFixed(2)}x (${(speedup / chunks * 100).toFixed(1)}% of ideal ${chunks}x)`);
}
console.log(`  concat list written: ${path.relative(ROOT, listPath).replaceAll('\\', '/')}`);
