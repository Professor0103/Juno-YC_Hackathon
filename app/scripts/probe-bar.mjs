/**
 * Finds the scrim alpha that puts --paper above 4.5:1 everywhere the input bar
 * can land. On a short viewport the bar rides up out of the grass and into the
 * gold field, which is lighter, so the field has to be in the sample too.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const srgbToLinear = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) => 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const PAPER = lum(0xfa, 0xeb, 0xe2);
const SCRIM = [0x2e, 0x3a, 0x34];

const img = sharp(path.join(root, 'assets-source', 'landscape.png'));
const meta = await img.metadata();

/**
 * backdrop-filter blurs before the scrim is composited, and the blur eats the
 * bright specular blades that set the worst case. Measuring the sharp image
 * therefore understates the real contrast. sigma is in source pixels: at 390
 * CSS px the 1024px source is downscaled ~2.6x, so a 14px CSS blur lands near
 * sigma 18 here.
 */
const buffers = {};
for (const sigma of [0, 12, 18]) {
  const pipeline = img.clone().removeAlpha();
  buffers[sigma] = (
    await (sigma ? pipeline.blur(sigma) : pipeline).raw().toBuffer({ resolveWithObject: true })
  ).data;
}
let data = buffers[0];

function worst(y0pct, y1pct, alpha) {
  const y0 = Math.floor((y0pct / 100) * meta.height);
  const y1 = Math.floor((y1pct / 100) * meta.height);
  let min = Infinity;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < meta.width; x++) {
      const i = (y * meta.width + x) * 3;
      const r = SCRIM[0] * alpha + data[i] * (1 - alpha);
      const g = SCRIM[1] * alpha + data[i + 1] * (1 - alpha);
      const b = SCRIM[2] * alpha + data[i + 2] * (1 - alpha);
      const c = contrast(PAPER, lum(r, g, b));
      if (c < min) min = c;
    }
  }
  return min;
}

const regions = [
  ['grass only          y 80-100', 80, 100],
  ['grass + low field   y 74-100', 74, 100],
  ['grass + low field   y 70-100', 70, 100],
];
const alphas = [0.24, 0.3, 0.36, 0.42, 0.48];

console.log('flat scrim: worst-case contrast of --paper over the scrimmed backdrop');
for (const sigma of [0, 18]) {
  data = buffers[sigma];
  console.log(`\nblur sigma ${sigma}`);
  console.log('  region'.padEnd(32) + alphas.map((a) => `a=${a}`.padStart(8)).join(''));
  for (const [name, y0, y1] of regions) {
    const row = alphas.map((a) => worst(y0, y1, a).toFixed(2).padStart(8)).join('');
    console.log('  ' + name.padEnd(30) + row);
  }
}

/**
 * The bar sits on the bottom edge and grows upward, so the backdrop behind its
 * top is lighter than the backdrop behind its bottom. A flat scrim therefore
 * has to be as dark as its worst row everywhere. A gradient can be light where
 * the grass is dark and only deepen where it has to, which keeps the grass
 * reading through the part of the bar the user actually looks at.
 *
 * This models that exactly: for a bar whose top edge is at image-y Y0, alpha
 * lerps from aTop at Y0 to aBottom at the bottom edge.
 */
function gradientBar(y0Pct, aTop, aBottom) {
  const y0 = Math.floor((y0Pct / 100) * meta.height);
  const y1 = meta.height;
  let min = Infinity;
  let worstY = 0;
  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - 1 - y0);
    const alpha = aTop + (aBottom - aTop) * t;
    for (let x = 0; x < meta.width; x++) {
      const i = (y * meta.width + x) * 3;
      const r = SCRIM[0] * alpha + data[i] * (1 - alpha);
      const g = SCRIM[1] * alpha + data[i + 1] * (1 - alpha);
      const b = SCRIM[2] * alpha + data[i + 2] * (1 - alpha);
      const c = contrast(PAPER, lum(r, g, b));
      if (c < min) {
        min = c;
        worstY = ((y / meta.height) * 100).toFixed(1);
      }
    }
  }
  return { min, worstY };
}

console.log('\n\ngradient scrim: alpha lerps aTop (bar top) -> aBottom (bar bottom)');
console.log('worst case, and the image-y where it occurs\n');
for (const sigma of [0, 18]) {
  data = buffers[sigma];
  console.log(`blur sigma ${sigma}`);
  for (const [aTop, aBottom] of [
    [0.5, 0.42],
    [0.58, 0.42],
    [0.62, 0.44],
    [0.68, 0.44],
    [0.72, 0.46],
  ]) {
    const cells = [62, 66, 70, 74, 78].map((y0) => {
      const { min, worstY } = gradientBar(y0, aTop, aBottom);
      const flag = min >= 4.5 ? ' ' : '!';
      return `${min.toFixed(2)}@${worstY}${flag}`.padStart(14);
    });
    console.log(`  ${aTop}->${aBottom}`.padEnd(14) + cells.join(''));
  }
  console.log('  bar top y0'.padEnd(14) + [62, 66, 70, 74, 78].map((y) => String(y).padStart(14)).join(''));
  console.log();
}
