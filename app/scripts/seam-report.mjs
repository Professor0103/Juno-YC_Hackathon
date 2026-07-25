/**
 * Reads a decoded screenshot strip taken across the sky/artwork boundary and
 * prints the mean colour of every row, so the seam can be judged on numbers
 * instead of on whether it looks like an edge. A mach band reads as an edge
 * even when the values are continuous, so what matters is both the step at the
 * boundary and the change in slope either side of it.
 *
 *   node scripts/seam-report.mjs <strip.png> <boundary-row>
 */
import path from 'node:path';
import sharp from 'sharp';

const [file, boundaryArg] = process.argv.slice(2);
const boundary = Number(boundaryArg);

const img = sharp(path.resolve(file));
const meta = await img.metadata();
const { data } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });

const rows = [];
for (let y = 0; y < meta.height; y++) {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let x = 0; x < meta.width; x++) {
    const i = (y * meta.width + x) * 3;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  rows.push([r / meta.width, g / meta.width, b / meta.width]);
}

const hex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

console.log(`strip ${meta.width}x${meta.height}, boundary at row ${boundary}\n`);
console.log('row   colour     dR    dG    dB');
for (let y = 0; y < rows.length; y++) {
  const prev = rows[y - 1];
  const d = prev ? rows[y].map((v, i) => v - prev[i]) : [0, 0, 0];
  const mark = y === boundary ? '  <- boundary' : '';
  console.log(
    `${String(y).padStart(3)}  ${hex(rows[y])}  ${d.map((v) => v.toFixed(1).padStart(5)).join(' ')}${mark}`,
  );
}

const step = rows[boundary].map((v, i) => Math.abs(v - rows[boundary - 1][i]));
console.log(`\nstep across the boundary: ${step.map((v) => v.toFixed(2)).join(', ')} / 255`);
console.log(step.every((v) => v < 1.5) ? 'PASS  no visible step' : 'FAIL  step is visible');
