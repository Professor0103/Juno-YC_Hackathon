/**
 * Page.captureScreenshot returns base64 inside JSON, which the CDP bridge
 * spills to a file once it is large. This turns that file back into a PNG so
 * screenshots taller than the real browser window can still be looked at.
 *
 *   node scripts/decode-shot.mjs <cdp-response.json> <out.png>
 */
import { readFile, writeFile } from 'node:fs/promises';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node scripts/decode-shot.mjs <cdp-response.json> <out.png>');
  process.exit(1);
}

const raw = JSON.parse(await readFile(input, 'utf8'));
const data = raw?.data ?? raw?.result?.data;
if (!data) {
  console.error('no screenshot data in', input, Object.keys(raw));
  process.exit(1);
}

await writeFile(output, Buffer.from(data, 'base64'));
console.log(output);
