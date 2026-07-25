/**
 * Locates the parts of the sky where --ink drops below 4.5:1, so the writing
 * zone can be bounded by measurement rather than by the numbers in the brief
 * (which came out optimistic against this render of the illustration).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'assets-source', 'landscape.png');

const srgbToLinear = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) => 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const INK = lum(0x2e, 0x3a, 0x34);

const img = sharp(file);
const meta = await img.metadata();
const { data } = await img.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });

const px = (x, y) => {
  const i = (y * meta.width + x) * 3;
  return contrast(INK, lum(data[i], data[i + 1], data[i + 2]));
};

console.log(`source ${meta.width}x${meta.height}\n`);

// Row-by-row worst case across the left 58%, in 2% steps of height.
const xMax = Math.floor(meta.width * 0.58);
console.log('y%    min    mean   %below4.5  (x 0-58%)');
for (let p = 0; p < 60; p += 2) {
  const y0 = Math.floor((p / 100) * meta.height);
  const y1 = Math.min(meta.height, Math.floor(((p + 2) / 100) * meta.height));
  let min = Infinity;
  let sum = 0;
  let n = 0;
  let bad = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < xMax; x++) {
      const c = px(x, y);
      if (c < min) min = c;
      if (c < 4.5) bad++;
      sum += c;
      n++;
    }
  }
  console.log(
    `${String(p).padStart(3)}  ${min.toFixed(2).padStart(6)}  ${(sum / n).toFixed(2).padStart(6)}  ${((bad / n) * 100).toFixed(2).padStart(8)}%`,
  );
}

// Whole candidate writing zones.
for (const zone of [
  { name: 'y 2-30, x 0-58', y0: 2, y1: 30, x0: 0, x1: 58 },
  { name: 'y 2-40, x 0-58', y0: 2, y1: 40, x0: 0, x1: 58 },
  { name: 'y 2-48, x 0-58', y0: 2, y1: 48, x0: 0, x1: 58 },
  { name: 'y 2-52, x 0-58', y0: 2, y1: 52, x0: 0, x1: 52 },
]) {
  let min = Infinity;
  let bad = 0;
  let n = 0;
  const y0 = Math.floor((zone.y0 / 100) * meta.height);
  const y1 = Math.floor((zone.y1 / 100) * meta.height);
  const x0 = Math.floor((zone.x0 / 100) * meta.width);
  const x1 = Math.floor((zone.x1 / 100) * meta.width);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const c = px(x, y);
      if (c < min) min = c;
      if (c < 4.5) bad++;
      n++;
    }
  }
  console.log(`\n${zone.name}: min ${min.toFixed(2)}, ${((bad / n) * 100).toFixed(3)}% below 4.5`);
}
