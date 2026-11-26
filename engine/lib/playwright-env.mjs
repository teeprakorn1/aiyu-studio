/**
 * @file playwright-env.mjs — playwright-core resolution and browser launching.
 * All engine scripts share this so browser-policy changes land in exactly one place.
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Resolve playwright-core from env PW_PKG or the project root's node_modules.
 * Exits the process with instructions when not found.
 *
 * @param {string} root - project root (the folder containing package.json)
 * @returns {import('playwright-core').ChromiumBrowserType} chromium browser type
 */
export function resolvePlaywright(root) {
  const candidates = [process.env.PW_PKG, path.join(root, 'package.json')].filter(Boolean);
  const pwPkg = candidates.find(p => existsSync(p.replace(/package\.json$/, 'node_modules/playwright-core')));
  if (!pwPkg) {
    console.error('playwright-core not found: run npm ci in the project folder (or set env PW_PKG to a package.json that has playwright-core installed)');
    process.exit(1);
  }
  return createRequire(pwPkg)('playwright-core').chromium;
}

/**
 * Launch the best available browser with an ordered fallback chain:
 * explicit binary → installed Chrome → playwright headless shell → playwright full chromium.
 *
 * @param {import('playwright-core').ChromiumBrowserType} chromium - browser type from resolvePlaywright()
 * @param {string} [explicitPath] - binary path from --browser / env CHROME_PATH
 * @returns {Promise<import('playwright-core').Browser>}
 */
export async function launchBrowser(chromium, explicitPath) {
  if (explicitPath) return chromium.launch({ executablePath: explicitPath });
  for (const opts of [{ channel: 'chrome' }, {}, { channel: 'chromium' }]) {
    try { return await chromium.launch(opts); }
    catch { /* try the next browser flavor */ }
  }
  console.error('No browser found. Install Google Chrome, or run: npx playwright-core install chromium');
  console.error('(or point to any Chrome/Chromium binary with env CHROME_PATH / --browser=path)');
  process.exit(1);
}

/**
 * Wait for a render page's window.ready promise with a bounded timeout.
 *
 * @param {import('playwright-core').Page} page - playwright page after navigation
 * @param {number} [timeoutMs=10000] - maximum wait in milliseconds
 * @returns {Promise<void>} resolves when the page reports ready
 */
export async function awaitPageReady(page, timeoutMs = 10000) {
  let timer;
  try {
    const ready = await Promise.race([
      page.evaluate(() => window.ready),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`page readiness timeout after ${timeoutMs}ms`)), timeoutMs); timer.unref(); }),
    ]);
    if (ready !== true) throw new Error('page did not expose a truthy window.ready promise');
  } finally { clearTimeout(timer); }
}
