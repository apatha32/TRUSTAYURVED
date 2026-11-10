// node scripts/slice.cjs in.png outPrefix sliceHeight scale
const sharp = require('sharp');
const [inp, pre, sh = 2000, sc = 0.55] = process.argv.slice(2);
(async () => { const m = await sharp(inp).metadata(); let i = 0;
  for (let y = 0; y < m.height; y += +sh, i++) { const h = Math.min(+sh, m.height - y);
    await sharp(inp).extract({ left: 0, top: y, width: m.width, height: h }).resize(Math.round(m.width * sc)).png().toFile(`${pre}-${i}.png`); }
  console.log(i, 'slices'); })();
