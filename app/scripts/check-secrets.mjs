/**
 * Fails the build if a credential is about to be shipped.
 *
 * Vite inlines every VITE_* variable into the bundle, and the product's entire
 * positioning is privacy. A judge who opens devtools and finds a key takes the
 * pitch with them, so this runs before every build rather than on a checklist.
 *
 * Scans src/ by default. Pass a directory to scan something else — `node
 * scripts/check-secrets.mjs dist` checks the built output, which is the thing the
 * judge can actually read.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const TARGET = process.argv[2] ?? 'src';

const FORBIDDEN = [
  // \b matters: it keeps "risk-averse" and "task-runner" out of the results while
  // still catching every real key, which is long and starts on a word boundary.
  { label: 'API key', pattern: /\bsk-[A-Za-z0-9_-]{8,}/ },
  { label: 'service-role key', pattern: /service_role/ },
  { label: 'model provider credential', pattern: /OPENAI/ },
];

const SKIP_DIRS = new Set(['node_modules', '.git']);
const TEXTUAL = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json', '.mjs', '.cjs', '.map', '.svg']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (TEXTUAL.has(extname(path))) yield path;
  }
}

let found = 0;

try {
  statSync(TARGET);
} catch {
  console.log(`check:secrets — ${TARGET}/ does not exist, nothing to scan`);
  process.exit(0);
}

for (const file of walk(TARGET)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const { label, pattern } of FORBIDDEN) {
      if (!pattern.test(line)) continue;
      found += 1;
      console.error(`${relative(process.cwd(), file)}:${i + 1}  ${label}  ${line.trim().slice(0, 120)}`);
    }
  });
}

if (found > 0) {
  console.error(`\ncheck:secrets FAILED — ${found} match(es) in ${TARGET}/. Nothing is built until this is empty.`);
  process.exit(1);
}

console.log(`check:secrets passed — ${TARGET}/ is clean`);
