#!/usr/bin/env node
// Parallel chunk render driver: splits the timeline into contiguous whole-second
// chunks and renders them concurrently through render.mjs.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq >= 0) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}

function usage() {
  console.log(`Usage: node publish-v4.mjs [options]

Options:
  --duration=<sec>        REQUIRED timeline end in seconds (rounded to whole seconds)
  --chunks=6              Number of parallel chunks/renderer processes
  --page=index.html       Page passed through to render.mjs
  --out=v4                Output prefix; chunk files are out/<out>_<from>-<to>.mp4
  --list=<path>           Concat list output path (default out/<out>concat.txt)
  --pw-pkg=<path>         package.json whose sibling node_modules has playwright-core
  --baseline-fps=<fps>    Optional single-process baseline for true scaling/speedup report
  --dry-run               Print chunk commands without rendering
  --help                  Show this help

Example:
  node publish-v4.mjs --duration=95 --chunks=6 --page=index.html --out=v1
`);
}

function fmtSec(s) {
  return `${s.toFixed(2)}s`;
}

function escapeConcatPath(p) {
  return p.replace(/'/g, "'\\''");
}

function makeBoundaries(end, chunks) {
  const bounds = [0];
  for (let k = 1; k < chunks; k++) bounds.push(Math.round((end * k) / chunks));
  bounds.push(end);
  return bounds.map((v, i, a) => (i === 0 ? v : Math.max(v, a[i - 1] + 1)));
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

const flags = parseArgs(process.argv.slice(2));
if (flags.help) {
  usage();
  process.exit(0);
}

if (flags.duration === undefined) { console.error('Missing required --duration=<sec> (read it from talk.js meta.totalSec)'); process.exit(1); }
const durationArg = Number(flags.duration);
const end = Math.round(durationArg);
const chunks = Math.max(1, Math.floor(Number(flags.chunks ?? 6)));
const page = String(flags.page ?? 'index.html');
const outPrefix = String(flags.out ?? 'v4');
const listPath = path.resolve(here, String(flags.list ?? path.join('out', outPrefix + 'concat.txt')));
const pwPkg = String(flags['pw-pkg'] ?? process.env.PW_PKG ?? path.join(here, 'package.json'));
const renderScript = path.join(here, 'render.mjs');

if (!Number.isFinite(durationArg) || durationArg <= 0) throw new Error(`Invalid --duration: ${flags.duration}`);
if (!Number.isFinite(end) || end < chunks) throw new Error(`Need at least one whole second per chunk (end=${end}, chunks=${chunks})`);
if (outPrefix.includes('/') || outPrefix.includes('\\')) throw new Error('--out must be a file-name prefix, not a path');
if (!existsSync(renderScript)) throw new Error(`render.mjs not found at ${renderScript}`);
if (!existsSync(pwPkg)) throw new Error(`playwright package.json not found: ${pwPkg}`);

const bounds = makeBoundaries(end, chunks);
const jobs = [];
for (let k = 0; k < chunks; k++) {
  const from = bounds[k];
  const to = bounds[k + 1];
  const range = `${from},${to}`;
  const fileRange = `${from}-${to}`;
  const output = path.join(here, 'out', `${outPrefix}_${fileRange}.mp4`);
  jobs.push({
    index: k,
    from,
    to,
    range,
    output,
    relOutput: path.relative(here, output).replaceAll('\\', '/'),
    frames: Math.round((to - from) * FPS),
    args: [renderScript, 'video', range, `--page=${page}`, `--out=${outPrefix}`],
  });
}

console.log(`publish-v4: ${chunks} parallel chunks, 0-${end}s, page=${page}, out=${outPrefix}`);
console.log(`publish-v4: machine reports ${os.cpus().length} logical CPUs; PW_PKG=${pwPkg}`);
console.log(`publish-v4: chunks: ${jobs.map(j => `[${j.from}-${j.to}]`).join(' ')}`);

if (flags['dry-run']) {
  for (const j of jobs) console.log(`dry-run chunk ${j.index}: node ${j.args.map(a => JSON.stringify(a)).join(' ')}`);
  process.exit(0);
}

const startedAll = Date.now();
const results = await Promise.all(jobs.map(job => new Promise(resolve => {
  const started = Date.now();
  const env = { ...process.env, PW_PKG: pwPkg };
  const child = spawn(process.execPath, job.args, { cwd: here, env, windowsHide: true });
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
console.log('\npublish-v4 chunk timing:');
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
  console.error('publish-v4: one or more chunks failed; concat list was not written');
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
console.log('\npublish-v4 summary:');
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
console.log(`  concat list written: ${path.relative(here, listPath).replaceAll('\\', '/')}`);
