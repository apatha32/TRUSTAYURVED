// Capture the hero at several moments: node scripts/frames.mjs <url> <outPrefix> <ms,ms,...> [scheme] [w] [h]
import { chromium } from 'playwright-core';
const [url, prefix, times, scheme = 'light', w = '1440', h = '900'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, colorScheme: scheme, deviceScaleFactor: 1 });
const logs = []; page.on('pageerror', (e) => logs.push(e.message)); page.on('console', (m) => m.type() === 'error' && logs.push(m.text()));
await page.goto(url, { waitUntil: 'load' });
const t0 = Date.now();
for (const t of times.split(',').map(Number)) {
  const d = t - (Date.now() - t0); if (d > 0) await page.waitForTimeout(d);
  await page.locator('[data-pool]').screenshot({ path: `${prefix}-${t}.png` });
}
console.log(logs.join('\n') || 'ok', await page.evaluate(() => document.querySelector('[data-pool]').className));
await browser.close();
