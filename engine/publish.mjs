#!/usr/bin/env node
/**
 * @file publish.mjs — parallel chunk render driver.
 * Splits the timeline into contiguous whole-second chunks and renders them
 * concurrently through render.mjs, then writes the ffmpeg concat list.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { parseArgs, assertKnownFlags, strFlag, numFlag } from './lib/cli-args.mjs';
import { readTalk } from './lib/talk.mjs';
import { planChunkJobs, escapeConcatPath } from './lib/chunking.mjs';
import { validateX264 } from './lib/encoding.mjs';
import { resolveInside } from './lib/paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
/** project root — engine scripts always run from the project root (npm scripts guarantee it) */
const ROOT = process.cwd();

function usage() {
  console.log(`Usage: node publish.mjs [options]

Options:
  --duration=<sec>        Timeline end override in seconds (default: ceil(TALK.dur); ceiled to whole seconds)
  --chunks=6              Number of parallel chunks/renderer processes (integer 1..64)
  --page=index.html       Page passed through to render.mjs
  --browser=path          Chrome/Chromium binary passed through to render.mjs (env CHROME_PATH also propagates to all chunks)
  --out=v1                Output prefix; chunk files are out/<out>_<from>-<to>.mp4
  --list=<path>           Concat list output path inside the project (default out/<out>concat.txt)
  --pw-pkg=<path>         package.json whose sibling node_modules has playwright-core
  --baseline-fps=<fps>    Optional single-process baseline for true scaling/speedup report
  --crf=20                x264 CRF passed through to every chunk
  --preset=medium         x264 preset passed through to every chunk
  --force                 Overwrite existing chunk files for this --out prefix (refused by default)
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

async function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  assertKnownFlags(flags, ['duration', 'chunks', 'page', 'browser', 'out', 'list', 'pw-pkg', 'baseline-fps', 'dry-run', 'help', 'crf', 'preset', 'force'], 'publish.mjs');
  if (flags.help) {
    usage();
    return;
  }

  const durationArg = flags.duration === undefined ? readTalk(path.join(ROOT, 'talk.js')).dur : numFlag(flags, 'duration', 0, { min: 0.001, max: 3600 });
  const end = Math.ceil(durationArg);
  const chunks = numFlag(flags, 'chunks', 6, { min: 1, max: 64, integer: true });
  const page = strFlag(flags, 'page', 'index.html');
  const outPrefix = strFlag(flags, 'out', 'v1');
  const listPath = resolveInside(ROOT, strFlag(flags, 'list', path.join('out', outPrefix + 'concat.txt')));
  const pwPkg = strFlag(flags, 'pw-pkg', process.env.PW_PKG ?? path.join(ROOT, 'package.json'));
  const renderScript = path.join(here, 'render.mjs');
  const force = flags.force !== undefined;
  const baselineFps = numFlag(flags, 'baseline-fps', NaN, { min: 0.001 });

  if (!Number.isFinite(durationArg) || durationArg <= 0) throw new Error(`Invalid --duration: ${flags.duration ?? 'missing talk.js'}`);
  if (!Number.isFinite(end) || end < chunks) throw new Error(`Need at least one whole second per chunk (end=${end}, chunks=${chunks})`);
  if (!outPrefix || outPrefix.includes('/') || outPrefix.includes('\\')) throw new Error('--out must be a file-name prefix, not a path');
  resolveInside(ROOT, page.split('?')[0]);
  if (!existsSync(renderScript)) throw new Error(`render.mjs not found at ${renderScript}`);
  if (!existsSync(pwPkg)) throw new Error(`playwright package.json not found: ${pwPkg}`);

  const encoding = validateX264(strFlag(flags, 'crf', '20'), strFlag(flags, 'preset', 'medium'));
  const jobs = planChunkJobs({ end, chunks, outPrefix, root: ROOT, page, browser: strFlag(flags, 'browser', undefined), crf: encoding.crf, preset: encoding.preset, force, renderScript });

  console.log(`publish: ${chunks} parallel chunks, 0-${end}s, page=${page}, out=${outPrefix}`);
  console.log(`publish: machine reports ${os.cpus().length} logical CPUs; PW_PKG=${pwPkg}`);
  console.log(`publish: chunks: ${jobs.map(j => `[${j.from}-${j.to}]`).join(' ')}`);

  if (flags['dry-run'] !== undefined) {
    for (const j of jobs) console.log(`dry-run chunk ${j.index}: node ${j.args.map(a => JSON.stringify(a)).join(' ')}`);
    return;
  }
  if (!force) {
    const existing = jobs.filter(j => existsSync(j.output)).map(j => j.relOutput);
    if (existing.length) throw new Error(`${existing.join(', ')} already exists — choose a new --out prefix (rendered versions are never overwritten) or pass --force`);
  }

  const children = new Set();
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.once(sig, () => {
      for (const c of children) c.kill();
      process.exit(sig === 'SIGINT' ? 130 : 143);
    });
  }

  const startedAll = Date.now();
  const results = await Promise.all(jobs.map(job => new Promise(resolve => {
    const started = Date.now();
    const env = { ...process.env, PW_PKG: pwPkg };
    const child = spawn(process.execPath, job.args, { cwd: ROOT, env, windowsHide: true });
    children.add(child);
    const stdoutSink = { buffer: '' };
    const stderrSink = { buffer: '' };
    attachPrefixedLines(child.stdout, `[c${job.index}]`, stdoutSink);
    attachPrefixedLines(child.stderr, `[c${job.index}!]`, stderrSink);
    child.on('error', err => {
      children.delete(child);
      for (const other of children) other.kill();
      resolve({ job, code: -1, wall: (Date.now() - started) / 1000, error: err, stdout: stdoutSink.buffer, stderr: stderrSink.buffer });
    });
    child.on('close', code => {
      children.delete(child);
      if (code !== 0) for (const other of children) other.kill();
      resolve({ job, code, wall: (Date.now() - started) / 1000, stdout: stdoutSink.buffer, stderr: stderrSink.buffer });
    });
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
      if (existsSync(job.output)) rmSync(job.output, { force: true });
      console.error(`  chunk ${r.job.index} failure details: exit=${r.code}${r.error ? ' spawnError=' + r.error.message : ''}`);
      if (r.stderr) console.error(`  stderr tail:\n${r.stderr.slice(-2500)}`);
      if (r.stdout) console.error(`  stdout tail:\n${r.stdout.slice(-1500)}`);
    }
  }

  if (failed) {
    console.error('publish: one or more chunks failed; concat list was not written');
    process.exitCode = 1;
    return;
  }

  mkdirSync(path.dirname(listPath), { recursive: true });
  const listDir = path.dirname(listPath);
  const lines = results.map(({ job }) => `file '${escapeConcatPath(path.relative(listDir, job.output).replaceAll('\\', '/'))}'`);
  writeFileSync(listPath, lines.join('\n') + '\n', 'utf8');

  const aggregateFps = totalFrames / parallelWall;
  const meanPerProcessFps = results.reduce((a, r) => a + r.job.frames / r.wall, 0) / results.length;
  console.log('\npublish summary:');
  console.log(`  parallel wall time: ${fmtSec(parallelWall)}`);
  console.log(`  sum of chunk times under parallel load: ${fmtSec(serialWall)}`);
  console.log(`  process overlap efficiency: ${(serialWall / (chunks * parallelWall) * 100).toFixed(1)}% (not serial speedup)`);
  console.log(`  aggregate throughput: ${aggregateFps.toFixed(2)} frames/s`);
  console.log(`  mean per-process throughput: ${meanPerProcessFps.toFixed(2)} frames/s`);
  if (Number.isFinite(baselineFps)) {
    const speedup = aggregateFps / baselineFps;
    console.log(`  speedup vs supplied ${baselineFps.toFixed(2)} fps serial baseline: ${speedup.toFixed(2)}x (${(speedup / chunks * 100).toFixed(1)}% of ideal ${chunks}x)`);
  }
  console.log(`  concat list written: ${path.relative(ROOT, listPath).replaceAll('\\', '/')}`);
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});
