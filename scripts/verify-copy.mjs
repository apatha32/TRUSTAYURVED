// Verifies every crawled text block (and footer copy) appears verbatim in the built page.
// Usage: node scripts/verify-copy.mjs   (after `astro build`)
import { readFileSync } from 'node:fs';
const crawl = JSON.parse(readFileSync('src/data/crawl.json', 'utf8'));
const posts = JSON.parse(readFileSync('src/data/posts.json', 'utf8'));
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const textOf = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const norm = (s) => s.replace(/\s+/g, ' ').replace(/^✔\s*/, '').trim();
let missing = 0, checked = 0;
for (const [key, page] of Object.entries(crawl)) {
  const file = `dist${page.path === '/' ? '/' : page.path}index.html`;
  const html = textOf(readFileSync(file, 'utf8'));
  const misses = [];
  for (const w of page.widgets) {
    for (const b of w.blocks) {
      const t = norm(b.text); if (!t) continue; checked++;
      if (!html.includes(t)) misses.push(`${w.loc}/${w.type}: ${t.slice(0, 90)}`);
    }
  }
  missing += misses.length;
  console.log(`${misses.length ? '✗' : '✓'} ${key} (${page.path})`);
  [...new Set(misses)].forEach((m) => console.log('    missing: ' + m));
}
for (const p of posts) {
  const html = textOf(readFileSync(`dist${new URL(p.link).pathname}index.html`, 'utf8'));
  const blocks = textOf(p.content).split(/\s{2,}/);
  const body = textOf(p.content).trim();
  const ok = html.includes(body) && html.includes(p.title);
  checked++; if (!ok) missing++;
  console.log(`${ok ? '✓' : '✗'} post ${p.slug}`);
}
console.log(`\n${checked} text blocks checked, ${missing} not found verbatim`);
