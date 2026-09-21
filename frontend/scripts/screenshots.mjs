/**
 * Captures the screenshots used in the README.
 *
 *   npm run dev -w frontend          # in another terminal
 *   npm run shots -w frontend
 *
 * Signed-in pages need a session, so this covers the pages anyone can reach.
 */
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE = process.env.SHOT_URL ?? 'http://localhost:5173';
// Relative to the repo root, wherever npm runs this from.
const OUT = fileURLToPath(new URL('../../docs/screenshots', import.meta.url));

const PAGES = [
  { name: 'landing', path: '/', wait: 1500 },
  { name: 'pricing', path: '/pricing', wait: 800 },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: theme,
    reducedMotion: 'reduce', // Hold the animated tour still so shots are repeatable.
  });
  const page = await context.newPage();
  for (const { name, path, wait } of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(wait);
    const suffix = theme === 'dark' ? '-dark' : '';
    await page.screenshot({ path: `${OUT}/${name}${suffix}.png` });
    console.log(`${OUT}/${name}${suffix}.png`);
  }
  await context.close();
}

await browser.close();
