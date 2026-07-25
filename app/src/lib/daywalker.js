/**
 * Daywalker covers 107 of 162 codepoints. Missing, per §6.2b of the front-end
 * spec: em dash, en dash, ellipsis, pound sign. The spec's own conclusion is
 * that the face must never be bound to user-generated content — but this
 * screen sets the user's writing in it deliberately, so the exposure is closed
 * at the other end: the characters are substituted on the way in.
 *
 * Substituting characters is permitted. Modifying or subsetting the font is
 * not (EULA clause 4), so the whole 12.6KB face ships as converted.
 */

/** The four the spec names, plus the near neighbours that would also tofu. */
const SUBSTITUTIONS = [
  [/[\u2014\u2013\u2012\u2015\u2010\u2011\u2212]/g, '-'], // em, en, figure, horizontal bar, hyphens, minus
  [/\u2026/g, '...'], // ellipsis
  [/\u00A3/g, 'GBP'], // pound
  [/\u2022/g, '*'], // bullet
];

/**
 * Normalises text so it can be set in Daywalker without falling back mid-line.
 * Run this on input, not on render: the user should see the substitution as
 * they type rather than watch their text change when it commits.
 */
export function normaliseForDaywalker(value) {
  let out = value;
  for (const [pattern, replacement] of SUBSTITUTIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** The characters that must never reach a Daywalker element. */
export const FORBIDDEN_IN_DAYWALKER = /[\u2014\u2013\u2026\u00A3]/;

/**
 * §6.2: "any Daywalker-classed element rendering \u2014 \u2013 \u2026 \u00A3
 * is a bug." This is that lint rule, as a runtime assertion. Development only —
 * it walks the DOM, and it should never be paying for itself in production.
 */
export function auditDaywalkerGlyphs(root = document) {
  const offenders = [];
  for (const el of root.querySelectorAll('[data-face="daywalker"]')) {
    const text = el.textContent ?? '';
    if (FORBIDDEN_IN_DAYWALKER.test(text)) {
      offenders.push({ el, text });
    }
  }
  if (offenders.length > 0) {
    console.error(
      `[daywalker] ${offenders.length} element(s) render a glyph the face does not contain:`,
      offenders,
    );
  }
  return offenders;
}
