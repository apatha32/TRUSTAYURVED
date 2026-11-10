// Derives brand assets from the clinic's existing logo + site icon (no new artwork).
import sharp from 'sharp';
const LOGO = 'src/assets/wp/2026/05/Gemini_Generated_Image_jc5d9zjc5d9zjc5d__1_-removebg-preview-1.png';
const ICON = 'src/assets/wp/2026/05/New-Project-83.png';
// Seal = the round emblem on the left of the logo lockup.
const trimmed = await sharp(LOGO).extract({ left: 0, top: 0, width: 250, height: 242 }).trim().toBuffer({ resolveWithObject: true });
console.log('seal', trimmed.info.width, trimmed.info.height);
await sharp(trimmed.data).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile('src/assets/brand/seal.png');
await sharp(ICON).resize(32, 32).png().toFile('public/favicon-32.png');
await sharp(ICON).resize(180, 180).flatten({ background: '#F3F6F2' }).png().toFile('public/apple-touch-icon.png');
await sharp(ICON).resize(512, 512).png().toFile('public/icon-512.png');
