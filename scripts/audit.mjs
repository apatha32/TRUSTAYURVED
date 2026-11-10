// Site audit: console errors, single <h1>, no horizontal scroll at 320px, axe-core (WCAG 2.2 AA) in light + dark.
// Usage: node scripts/audit.mjs [baseUrl]
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:4321';
const axe = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
const paths = [...sitemap.matchAll(/<loc>https:\/\/trustayurved\.com([^<]*)<\/loc>/g)].map((m) => m[1]).concat(['/compare/', '/style-guide/']);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
let problems = 0;
for (const path of [...new Set(paths)]) {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
    const errs = [];
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    page.on('pageerror', (e) => errs.push(e.message));
    const res = await page.goto(base + path, { waitUntil: 'networkidle' });
    if (res.status() >= 400) { console.log(`✗ ${path} HTTP ${res.status()}`); problems++; await page.close(); continue; }
    await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in')));
    await page.waitForTimeout(700);
    await page.addScriptTag({ content: axe });
    const r = await page.evaluate(async () => {
      const out = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, rules: { 'region': { enabled: false } } });
      return { v: out.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 2).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]) })), h1: document.querySelectorAll('h1').length };
    });
    let overflow = null;
    if (scheme === 'light') {
      await page.setViewportSize({ width: 320, height: 700 });
      await page.waitForTimeout(150);
      overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    }
    const bad = r.v.length || r.h1 !== 1 || errs.length || overflow > 0;
    if (bad) problems++;
    console.log(`${bad ? '✗' : '✓'} ${path} [${scheme}] h1=${r.h1}${overflow !== null ? ` overflow320=${overflow}` : ''}${errs.length ? ' errors=' + JSON.stringify(errs) : ''}`);
    for (const v of r.v) console.log(`    ${v.impact} ${v.id} ×${v.n}\n      ${v.ex.join('\n      ')}`);
    await page.close();
  }
}
await browser.close();
console.log(problems ? `\n${problems} page/scheme combinations with issues` : '\nAll clear');
