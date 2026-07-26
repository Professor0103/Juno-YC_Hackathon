/**
 * The deterministic crisis pre-filter (PSD 3.6, and PSD 3.2's rule that Chart
 * mode makes zero AI calls at the point of writing).
 *
 * Runs locally on submit. No network, no latency, no model. It is the only
 * screening that exists in Chart mode, and in Reflection it stands in front of
 * the concurrent model screen rather than being replaced by it.
 *
 * The hard problem is not recall, it is precision on this specific population.
 * Healthcare staff write "we lost her to an overdose", "the patient had taken
 * her own life", "third suicide attempt this month" as ordinary description of a
 * shift. A word list alone would interrupt a nurse describing her work with a
 * crisis card, which is both wrong and patronising, and would do it on stage.
 *
 * So the filter splits into two: phrases that are inherently self-referring, and
 * phrases that are only a signal when the writer is talking about themselves. The
 * second group has to find a first-person subject in the same sentence.
 *
 * It records nothing and returns nothing but a boolean. There is no score, no
 * matched term in the return value, and nothing to log.
 */

/** Self-referring by construction — "myself", "my own life" carry the subject. */
const EXPLICIT = [
  /\bkill(?:ing)?\s+myself\b/,
  /\bend(?:ing)?\s+my\s+(?:own\s+)?life\b/,
  /\btak(?:e|ing)\s+my\s+own\s+life\b/,
  /\b(?:harm|hurt|cut|cutting|starve|starving)\s+myself\b/,
  /\bhang(?:ing)?\s+myself\b/,
  // Deliberately no /kill me/. "This rota is going to kill me" is ordinary
  // complaint language in this population; "kill myself" is not.
  /\bi\s+(?:want|need|have)\s+to\s+die\b/,
  /\bi\s+(?:don'?t|do\s+not)\s+want\s+to\s+(?:be\s+here|wake\s+up|live|exist)\b/,
  /\bi\s+(?:can'?t|cannot|could\s+not|couldn'?t)\s+(?:go\s+on|do\s+this\s+any\s*more|keep\s+going)\b/,
  // Kept in the unconditional list even though it carries no first-person marker:
  // in a private journal an unattributed statement is about the writer. The cost
  // is that "she said there was no reason to live" also flags, which is a card the
  // writer can dismiss — cheaper than missing the real thing.
  /\bno\s+(?:reason|point)\s+(?:in\s+|to\s+)?(?:liv(?:e|ing)|go(?:ing)?\s+on|be(?:ing)?\s+here)\b/,
  /\bnothing\s+to\s+live\s+for\b/,
];

/**
 * Real signals, but routinely written about patients and colleagues. Each needs a
 * first-person subject in the same sentence before it counts.
 */
const AMBIGUOUS = [
  /\bsuicidal\b/,
  /\bsuicide\b/,
  /\boverdose\b/,
  /\bself[-\s]?harm/,
  /\bwant(?:ed|s)?\s+to\s+die\b/,
  /\bbetter\s+off\s+dead\b/,
  /\bwish(?:ed)?\s+(?:i\s+(?:was|were)|to\s+be)\s+dead\b/,
  /\bnot\s+(?:be|being)\s+here\s+any\s*more\b/,
  /\bdisappear\s+(?:for\s+good|permanently|forever)\b/,
];

/** First person as a grammatical subject or possessor, not the letter "i". */
const FIRST_PERSON = /\b(?:i|i'?m|im|i'?ve|ive|i'?d|id|my|me|myself|mine)\b/;

/**
 * Third-person framing that survives sentence splitting and reliably marks
 * clinical narration: "she had taken", "the patient", "he was found".
 */
const CLINICAL_SUBJECT =
  /\b(?:patient|pt|resident|client|casualty|deceased|she|he|they|him|her|them|his|their|colleague|nurse|doctor|reg|consultant|student|mum|dad|son|daughter|wife|husband|family)\b/;

const sentences = (text) =>
  text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .split(/(?<=[.!?;\n])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * @param {string} text what the user just wrote
 * @returns {boolean} whether to interrupt and show the support card
 */
export function looksLikeCrisis(text) {
  if (typeof text !== 'string' || text.trim().length === 0) return false;

  for (const sentence of sentences(text)) {
    if (EXPLICIT.some((pattern) => pattern.test(sentence))) return true;

    if (AMBIGUOUS.some((pattern) => pattern.test(sentence))) {
      // "I have been thinking about suicide" flags. "I keep thinking about her
      // overdose" does not — that is grief about a patient, and interrupting it
      // with a crisis card is the failure this filter exists to avoid. Sentences
      // that name someone else are read as narration and left alone; anything
      // genuinely self-referring that this drops is still in front of the
      // concurrent model screen, which is why there are two layers.
      if (FIRST_PERSON.test(sentence) && !CLINICAL_SUBJECT.test(sentence)) return true;
    }
  }

  return false;
}
