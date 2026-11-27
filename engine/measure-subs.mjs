/**
 * @file measure-subs.mjs — subtitle width acceptance check.
 * Renders every dialogue line through the real layoutSubs() in the browser and fails
 * when any line's frame exceeds the 840px safe width.
 *
 * Usage (run from the project root):
 *   node engine/measure-subs.mjs [--page=index.html] [--browser=path]
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, assertKnownFlags, strFlag } from './lib/cli-args.mjs';
import { resolvePlaywright, launchBrowser, awaitPageReady } from './lib/playwright-env.mjs';
import { resolveInside } from './lib/paths.mjs';

/** project root — engine scripts always run from the project root (npm scripts guarantee it) */
const ROOT = process.cwd();

async function main() {
  const { flags, pos } = parseArgs(process.argv.slice(2));
  assertKnownFlags(flags, ['page', 'browser', 'help'], 'measure-subs.mjs');
  if (flags.help) {
    console.log('Usage: node engine/measure-subs.mjs [--page=index.html] [--browser=path]');
    return 0;
  }
  const pageFile = resolveInside(ROOT, strFlag(flags, 'page', pos[0] ?? 'index.html'));
  const browser = await launchBrowser(resolvePlaywright(ROOT), strFlag(flags, 'browser', process.env.CHROME_PATH));
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    let pageError = '';
    page.on('pageerror', e => { pageError = e.message; console.error('PAGE ERROR', e.message); });
    await page.goto(pathToFileURL(pageFile).href);
    await awaitPageReady(page);
    if (pageError) throw new Error(`page script error: ${pageError}`);
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
        overflow: !!lay.overflow || lay.frameWidth > 840,
      };
    }));
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
      return 2;
    }
    console.log('subtitle width acceptance: PASS');
    return 0;
  } finally {
    await browser.close();
  }
}

main().then(code => { process.exitCode = code; }, err => {
  console.error(err.message);
  process.exitCode = 1;
});
