import type { ImageMetadata } from 'astro';

/** All crawled WordPress uploads, keyed by their path after /wp-content/uploads/. */
const files = import.meta.glob<{ default: ImageMetadata }>('../assets/wp/**/*.{png,jpg,jpeg,webp}', { eager: true });

const byPath = new Map<string, ImageMetadata>();
for (const [k, mod] of Object.entries(files)) byPath.set(k.split('/assets/wp/')[1], mod.default);

/** Resolve a live-site upload URL (or "2026/05/x.png") to a local optimisable asset. */
export function wpImage(urlOrPath: string): ImageMetadata {
  const key = urlOrPath.includes('/wp-content/uploads/') ? urlOrPath.split('/wp-content/uploads/')[1] : urlOrPath;
  const meta = byPath.get(key);
  if (!meta) throw new Error(`Image not crawled: ${key}`);
  return meta;
}

export const LOGO = '2026/05/Gemini_Generated_Image_jc5d9zjc5d9zjc5d__1_-removebg-preview-1.png';
export const SITE_ICON = '2026/05/New-Project-83.png';
export const SHIRODHARA = '2026/05/New-Project-2026-05-31T115440.517.png';
