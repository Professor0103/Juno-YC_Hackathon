/**
 * Prepares the two binary assets the home screen depends on.
 *
 * 1. Daywalker.ttf -> woff2. Conversion is permitted by clause 5 of the EULA;
 *    subsetting is not, so the whole face ships.
 * 2. The landscape PNG -> AVIF + WebP at several widths, and a report of the
 *    exact colours on its top and bottom edges. Those two colours are what the
 *    CSS sky and grass extensions have to match, so they are measured rather
 *    than eyeballed.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import ttf2woff2 from 'ttf2woff2';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'assets-source');
const publicDir = path.join(root, 'public');
const imageOut = path.join(publicDir, 'landscape');
const fontOut = path.join(publicDir, 'fonts');
const spriteOut = path.join(publicDir, 'sprites');

const WIDTHS = [640, 1024, 1536, 2048];

const hex = ({ r, g, b }) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

/**
 * Mean colour of a horizontal band, given as a fraction of image height.
 * sharp's stats() reads the input image rather than the pipeline, so the band
 * has to be materialised to a buffer before it can be measured.
 */
async function bandColour(img, meta, fromPct, toPct) {
  const top = Math.min(meta.height - 1, Math.floor((fromPct / 100) * meta.height));
  const height = Math.max(1, Math.min(meta.height - top, Math.round(((toPct - fromPct) / 100) * meta.height)));
  const buf = await img
    .clone()
    .extract({ left: 0, top, width: meta.width, height })
    .png()
    .toBuffer();
  const { channels } = await sharp(buf).stats();
  return hex({ r: channels[0].mean, g: channels[1].mean, b: channels[2].mean });
}

const srgbToLinear = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const relLuminance = (r, g, b) =>
  0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
const contrast = (a, b) => {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};
const parseHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/**
 * Worst-case contrast of a foreground colour over every pixel of a region,
 * optionally with a scrim composited over the region first. This is the check
 * that decides whether the input bar needs its stabilising layer: an average
 * says nothing when the backdrop is painted grass.
 */
async function contrastOverRegion(img, meta, fg, region, scrim) {
  const left = Math.floor((region.x0 / 100) * meta.width);
  const width = Math.max(1, Math.floor(((region.x1 - region.x0) / 100) * meta.width));
  const top = Math.floor((region.y0 / 100) * meta.height);
  const height = Math.max(1, Math.floor(((region.y1 - region.y0) / 100) * meta.height));

  const { data } = await img
    .clone()
    .extract({ left, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const [fr, fg_, fb] = parseHex(fg);
  const fl = relLuminance(fr, fg_, fb);
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  const count = data.length / 3;

  for (let i = 0; i < data.length; i += 3) {
    let [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (scrim) {
      const [sr, sg, sb] = parseHex(scrim.colour);
      const a = scrim.alpha;
      r = sr * a + r * (1 - a);
      g = sg * a + g * (1 - a);
      b = sb * a + b * (1 - a);
    }
    const c = contrast(fl, relLuminance(r, g, b));
    if (c < min) min = c;
    if (c > max) max = c;
    sum += c;
  }
  return { min: +min.toFixed(2), max: +max.toFixed(2), mean: +(sum / count).toFixed(2) };
}

async function buildFont() {
  await mkdir(fontOut, { recursive: true });
  const ttf = await readFile(path.join(source, 'Daywalker.ttf'));
  const woff2 = ttf2woff2(ttf);
  await writeFile(path.join(fontOut, 'Daywalker.woff2'), woff2);
  console.log(`font   Daywalker.woff2  ${(woff2.length / 1024).toFixed(1)}KB (from ${(ttf.length / 1024).toFixed(1)}KB ttf)`);
}

async function buildImage() {
  await mkdir(imageOut, { recursive: true });
  const file = path.join(source, 'landscape.png');
  const img = sharp(file);
  const meta = await img.metadata();
  console.log(`image  source ${meta.width}x${meta.height}  ratio ${(meta.width / meta.height).toFixed(3)}`);

  const widths = [...new Set(WIDTHS.filter((w) => w <= meta.width).concat(meta.width))].sort((a, b) => a - b);

  for (const w of widths) {
    for (const [format, opts] of [
      ['avif', { quality: 62, effort: 6 }],
      ['webp', { quality: 78 }],
    ]) {
      const out = path.join(imageOut, `landscape-${w}.${format}`);
      const info = await img.clone().resize({ width: w }).toFormat(format, opts).toFile(out);
      console.log(`image  landscape-${w}.${format}  ${(info.size / 1024).toFixed(1)}KB`);
    }
  }

  const report = {
    intrinsicWidth: meta.width,
    intrinsicHeight: meta.height,
    aspectRatio: Number((meta.width / meta.height).toFixed(4)),
    widths,
    edges: {
      topEdge: await bandColour(img, meta, 0, 0.6),
      top2pct: await bandColour(img, meta, 0, 2),
      bottomEdge: await bandColour(img, meta, 99.4, 100),
      bottom2pct: await bandColour(img, meta, 98, 100),
    },
    bands: {
      deepSky: await bandColour(img, meta, 0, 8),
      writingZone: await bandColour(img, meta, 4, 30),
      overClouds: await bandColour(img, meta, 30, 50),
      field: await bandColour(img, meta, 54, 74),
      grass: await bandColour(img, meta, 74, 100),
      inputBarBand: await bandColour(img, meta, 84, 94),
    },
    contrast: {
      'ink on sky writing zone': await contrastOverRegion(img, meta, '#2E3A34', {
        x0: 0,
        x1: 58,
        y0: 2,
        y1: 50,
      }),
      'paper on bare grass': await contrastOverRegion(img, meta, '#FAEBE2', {
        x0: 4,
        x1: 96,
        y0: 80,
        y1: 97,
      }),
      'paper on grass behind scrim': await contrastOverRegion(
        img,
        meta,
        '#FAEBE2',
        { x0: 4, x1: 96, y0: 80, y1: 97 },
        { colour: '#2E3A34', alpha: 0.3 },
      ),
      'paper on grass behind scrim @0.42': await contrastOverRegion(
        img,
        meta,
        '#FAEBE2',
        { x0: 4, x1: 96, y0: 80, y1: 97 },
        { colour: '#2E3A34', alpha: 0.42 },
      ),
      'paper on grass behind scrim @0.52': await contrastOverRegion(
        img,
        meta,
        '#FAEBE2',
        { x0: 4, x1: 96, y0: 80, y1: 97 },
        { colour: '#2E3A34', alpha: 0.52 },
      ),
    },
  };

  await writeFile(path.join(imageOut, 'composition.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

/**
 * The bear's frames, laid out left to right as one sheet.
 *
 * The bear ambles forward and then back again rather than cutting from the
 * last frame to the first. A GIF cannot express that without carrying the
 * reversed frames as extra frames, and sharp cannot author an animated GIF
 * from scratch anyway (libvips wants a page-height it will only read off a
 * multi-page input). CSS can: `animation-direction: alternate` over a
 * steps() sprite is exactly a forward-and-back loop, at half the frames.
 *
 * The frame count goes into the JSON beside it so the CSS doesn't have to be
 * kept in step with the sheet by hand.
 */
async function buildBear() {
  await mkdir(spriteOut, { recursive: true });
  const file = path.join(source, 'bear-resting.gif');
  const meta = await sharp(file, { animated: true }).metadata();
  const frames = meta.pages;
  const size = meta.pageHeight;

  // The animated read gives one tall strip; the sheet wants it lying down.
  const strip = await sharp(file, { animated: true }).png().toBuffer();
  const tiles = await Promise.all(
    Array.from({ length: frames }, (_, i) =>
      sharp(strip)
        .extract({ left: 0, top: i * size, width: meta.width, height: size })
        .png()
        .toBuffer(),
    ),
  );

  const sheet = path.join(spriteOut, 'bear-resting-sheet.png');
  const info = await sharp({
    create: {
      width: meta.width * frames,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(tiles.map((input, i) => ({ input, left: i * meta.width, top: 0 })))
    .png({ compressionLevel: 9, palette: true })
    .toFile(sheet);

  await writeFile(
    path.join(spriteOut, 'bear-resting.json'),
    JSON.stringify({ frames, frame: meta.width, delay: meta.delay[0] ?? 200 }, null, 2),
  );

  console.log(
    `sprite bear-resting-sheet.png  ${frames} frames  ${(info.size / 1024).toFixed(1)}KB`,
  );
}

await buildFont();
await buildImage();
await buildBear();
