/**
 * @file ffmpeg.mjs — ffmpeg/ffprobe process helpers shared by mux and future engine scripts.
 */
import { spawn } from 'node:child_process';

/**
 * Quote one shell token for display purposes (single-quote style).
 *
 * @param {string} s - raw token
 * @returns {string} printable token
 */
export function shellQuote(s) {
  const text = String(s);
  return /^[A-Za-z0-9_./:=+-]+$/.test(text) ? text : `'${text.replace(/'/g, `'\\''`)}'`;
}

/**
 * Render a command + args as a copy-pasteable shell line.
 *
 * @param {string} cmd - executable
 * @param {string[]} args - argument list
 * @returns {string} printable command line
 */
export function printCommand(cmd, args) {
  return [cmd, ...args].map(shellQuote).join(' ');
}

/**
 * Run a process to completion, capturing stdout/stderr; rejects with tail of stderr on failure.
 *
 * @param {string} cmd - executable on PATH
 * @param {string[]} args - argument list
 * @param {{ progress?: boolean }} [opts] - progress: log ffmpeg encode progress every ~20s
 * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
 */
export function runProcess(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const cap = 1024 * 1024;
    let lastProgress = 0;
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => {
      const text = d.toString();
      stderr += text;
      if (stderr.length > cap) stderr = stderr.slice(-cap);
      if (opts.progress) {
        const m = text.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (m) {
          const t = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
          if (t - lastProgress >= 20) {
            lastProgress = t;
            console.log(`  encode progress: ${t.toFixed(1)}s`);
          }
        }
      }
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve({ stdout, stderr, code });
      else {
        const err = new Error(`${cmd} exited with code ${code}\n${stderr.slice(-5000)}`);
        err.stdout = stdout;
        err.stderr = stderr;
        err.code = code;
        reject(err);
      }
    });
  });
}

/**
 * Probe a media file with ffprobe and parse the JSON output.
 *
 * @param {string} file - media file path
 * @param {string} [extraEntries] - -show_entries override (defaults to the publish-QC set)
 * @returns {Promise<object>} parsed ffprobe JSON { streams, format }
 */
export async function ffprobeJson(file, extraEntries) {
  const entries = extraEntries || 'stream=index,codec_name,codec_type,width,height,pix_fmt,color_range,color_space,color_primaries,color_transfer,r_frame_rate,avg_frame_rate,nb_frames,duration,sample_rate,channels,channel_layout,profile,bit_rate:format=duration,size,bit_rate';
  const r = await runProcess('ffprobe', ['-v', 'error', '-show_entries', entries, '-of', 'json', file]);
  return JSON.parse(r.stdout);
}

/**
 * Parse an ffmpeg rational ("30000/1001") into a number.
 *
 * @param {string} x - rational string
 * @returns {number} numeric value, NaN when missing
 */
export function parseRational(x) {
  if (!x) return NaN;
  const [n, d = '1'] = String(x).split('/');
  return Number(n) / Number(d);
}
