/**
 * Finds the tree's real bounding box. The brief gives it as "roughly x 60-97%,
 * y 20-66%", and the layout now depends on that top edge exactly: it sets how
 * much of the artwork may be cropped off the top before the canopy is cut.
 *
 * The canopy is the only thing in the upper half of the image that is both
 * dark and green, so that is what it looks for.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const img = sharp(path.join(root, 'assets-source', 'landscape.png'));
const meta = await img.metadata();
const { data } = await img.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });

const srgbToLinear = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) =>
  0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);

/**
 * Above the horizon the only thing darker than the sky is the tree, so a
 * luminance floor separates them cleanly without having to guess the paint
 * colour. The sky's darkest pixel sits near 0.40; the canopy is far below it.
 */
const CANOPY_MAX_LUM = 0.28;
const pct = (v, total) => +((v / total) * 100).toFixed(1);

const horizon = Math.floor(meta.height * 0.52);
let top = Infinity;
let left = Infinity;
let right = -Infinity;
const perRow = [];

for (let y = 0; y < horizon; y++) {
  let count = 0;
  let rowMin = Infinity;
  for (let x = 0; x < meta.width; x++) {
    const i = (y * meta.width + x) * 3;
    const l = lum(data[i], data[i + 1], data[i + 2]);
    if (l < rowMin) rowMin = l;
    if (l < CANOPY_MAX_LUM) {
      count++;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
    }
  }
  perRow.push({ count, rowMin });
}

console.log(`source ${meta.width}x${meta.height}\n`);
console.log('canopy, measured above the horizon by luminance:');
console.log(`  top   y ${pct(top, meta.height)}%`);
console.log(`  x     ${pct(left, meta.width)}% - ${pct(right, meta.width)}%\n`);

console.log('per row: dark pixels, and the darkest luminance in the row');
for (let p = 0; p < 52; p += 2) {
  const y = Math.min(horizon - 1, Math.floor((p / 100) * meta.height));
  const r = perRow[y];
  console.log(`  ${String(p).padStart(3)}%  ${String(r.count).padStart(5)}   ${r.rowMin.toFixed(3)}`);
}

/**
 * What the layout actually needs: the largest fraction that can be cropped off
 * the top of the artwork before the canopy is touched.
 */
console.log(`\nsafe top crop: ${pct(top, meta.height)}% of the artwork's height`);
console.log(`=> artwork may be up to ${(1 / (1 - top / meta.height)).toFixed(3)}x the stage height`);
