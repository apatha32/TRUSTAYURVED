// Screenshot helper: node scripts/shoot.mjs <url> <out.png> [width] [height] [scheme] [fullPage] [reducedMotion] [waitMs]
import { chromium } from 'playwright-core';
const [url, out, w = '1440', h = '900', scheme = 'light', full = '1', rm = 'no-preference', wait = '2500'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, colorScheme: scheme, reducedMotion: rm, deviceScaleFactor: +w < 600 ? 2 : 1 });
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'networkidle' });
if (full === '1') {
  // reveal everything & load lazy images for a full-page capture
  await page.evaluate(async () => {
    document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in'));
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
  });
}
if (full === '1') {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: +w, height });
  await page.waitForLoadState('networkidle');
}
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
console.log(logs.join('\n') || 'no console errors');
await browser.close();
