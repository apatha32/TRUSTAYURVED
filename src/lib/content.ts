/**
 * Content access. Every string rendered on the site comes from
 * src/data/crawl.json / posts.json (a verbatim snapshot of trustayurved.com
 * produced by scripts/crawl.py). Nothing here retypes copy; it only selects
 * and groups crawled widgets by position.
 */
import crawl from '../data/crawl.json';
import postsRaw from '../data/posts.json';

export type Block = { t: string; text: string };
export type Img = { src: string; alt: string };
export type Widget = { type: string; loc: string; blocks: Block[]; imgs: Img[]; links: string[] };
export type Page = { path: string; title: string; description: string; widgets: Widget[]; maps: string[] };
export type PageKey = keyof typeof crawl;

const pages = crawl as unknown as Record<string, Page>;

export function page(key: string): Page {
  const p = pages[key];
  if (!p) throw new Error(`No crawled page "${key}"`);
  return p;
}

/** Main-content widgets only (header/footer excluded). */
export function main(key: string): Widget[] {
  return page(key).widgets.filter((w) => w.loc === 'main');
}

/** i-th main widget; throws if the crawl shape changed (so drift is loud). */
export function w(key: string, i: number, type?: string): Widget {
  const widget = main(key)[i];
  if (!widget) throw new Error(`${key}[${i}] missing`);
  if (type && widget.type !== type) throw new Error(`${key}[${i}] is ${widget.type}, expected ${type}`);
  return widget;
}

/** All text of a widget joined (headings split over lines are re-joined with a space). */
export function text(widget: Widget): string {
  return widget.blocks.map((b) => b.text).join(' ');
}

export function footer(): Widget[] {
  return page('home').widgets.filter((x) => x.loc === 'footer');
}

/* ---------------------------------------------------------------------------
   Section grouping for long-form pages (treatments, doctors, policies)
   ------------------------------------------------------------------------- */
export type Section = { heading: string; blocks: Block[]; image?: Img };

/**
 * Pairs each H2 heading with its text-editor. Elementor sometimes renders the
 * text *before* its heading (visual order flipped with CSS) — `textFirst`
 * handles that. Images are assigned to sections in document order when the
 * counts match (each row on the live site is one image + one section).
 */
export function sections(key: string, from: number, opts: { textFirst?: boolean; headingTag?: string; to?: number } = {}): Section[] {
  const list = main(key).slice(from, opts.to);
  const tag = opts.headingTag ?? 'h2';
  const out: Section[] = [];
  const imgs: Img[] = [];
  for (let i = 0; i < list.length; i++) {
    const cur = list[i];
    if (cur.type === 'image') { imgs.push(...cur.imgs); continue; }
    if (opts.textFirst) {
      const next = list[i + 1];
      if (cur.type === 'text-editor' && next?.type === 'heading' && next.blocks[0]?.t === tag) {
        out.push({ heading: text(next), blocks: cur.blocks });
        i++;
      }
    } else if (cur.type === 'heading' && cur.blocks[0]?.t === tag) {
      const next = list[i + 1];
      if (next?.type === 'text-editor') {
        out.push({ heading: text(cur), blocks: next.blocks });
        i++;
      }
    }
  }
  if (imgs.length === out.length) out.forEach((s, i) => (s.image = imgs[i]));
  return out;
}

/** h3 heading + text pairs (feature cards). */
export function pairs(key: string, from: number, to?: number): { heading: string; body: Block[] }[] {
  const list = main(key).slice(from, to);
  const out: { heading: string; body: Block[] }[] = [];
  for (let i = 0; i < list.length - 1; i++) {
    if (list[i].type === 'heading' && list[i + 1].type === 'text-editor') {
      out.push({ heading: text(list[i]), body: list[i + 1].blocks });
      i++;
    }
  }
  return out;
}

/** Splits accordion widget blocks into Q/A pairs (alternating). */
export function faqs(widget: Widget): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  for (let i = 0; i + 1 < widget.blocks.length; i += 2) out.push({ q: widget.blocks[i].text, a: widget.blocks[i + 1].text });
  return out;
}

/* ---------------------------------------------------------------------------
   Blog
   ------------------------------------------------------------------------- */
export type Post = { slug: string; date: string; link: string; title: string; excerpt: string; content: string; featured: string | null };
export const posts = (postsRaw as Post[]).slice().sort((a, b) => b.date.localeCompare(a.date));

export function postPath(p: Post): string {
  return new URL(p.link).pathname;
}

/** Same format the live site prints: "May 29, 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

/** WP post HTML → clean HTML (drops WP classes and empty runs). Content unchanged. */
export function cleanPostHtml(html: string): string {
  return html
    .replace(/\s+class="wp-block-[^"]*"/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/* ---------------------------------------------------------------------------
   Site facts (all copied from crawled pages)
   ------------------------------------------------------------------------- */
export const WHATSAPP_NUMBER = '919016011528'; // live site's click-to-chat plugin setting
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;
