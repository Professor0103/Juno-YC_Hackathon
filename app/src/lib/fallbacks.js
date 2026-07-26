/**
 * Demo determinism (PSD 4.1): a bad network must not kill the pitch.
 *
 * The opening turn falls back to a cached question keyed by text_id, because the
 * poem is the thing both the writer and the question are anchored to, and the poem
 * is known in advance — so a cached question there can still be a real close
 * reading.
 *
 * Later turns cannot be cached, for the same reason the artifact could not be: by
 * then the only honest question is one built out of what this person actually
 * typed, and a canned one would be the single place in the product that pretends to
 * have read something it has not. So later turns fall back to composing a question
 * locally, out of the words in front of it. Blunter than the model, but it cannot
 * invent, and it needs no network either.
 */

export const SEEDED_TEXT_ID = '00000000-0000-4000-8000-000000000001';

/** Keyed by text_id, so adding a text means adding its fallback beside it. */
export const CACHED_DEEPENING = {
  [SEEDED_TEXT_ID]:
    "Dickinson doesn't call the thing under the incision the patient, or the wound. She calls it the Culprit. Reading back what you just wrote, what is the Culprit in it?",
};

const words = (line) => line.trim().split(/\s+/).filter(Boolean).length;

const tidy = (line) =>
  line
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:.\-—]+/, '')
    .replace(/[\s,;:.]+$/, '')
    .trim();

/** Trimmed to something quotable, on a word boundary. */
const clip = (phrase, limit = 11) => {
  const parts = phrase.split(/\s+/);
  return parts.length <= limit ? phrase : `${parts.slice(0, limit).join(' ')}…`;
};

/**
 * A continuing question without a model: find the most substantial clause in what
 * they just wrote and hand it back as the thing to stay with.
 *
 * Adds no word that was not typed, beyond the frame around the quotation. It cannot
 * read across the session the way the model does — that is the cost of the network
 * being down — but it is still pointing at something they actually wrote.
 *
 * @param {string} message their most recent writing
 * @returns {string} one question
 */
export function composeFallbackQuestion(message) {
  const source = (message ?? '').trim();
  if (!source) return 'Stay with that for a moment. What is underneath it?';

  const clauses = source
    .split(/[.!?;:\n]+|,\s+(?=(?:and|but|then|so|because|which|while|until|though)\b)/i)
    .map(tidy)
    .filter((line) => words(line) >= 3);

  if (clauses.length === 0) {
    return `You wrote "${clip(tidy(source))}". Where does that come from?`;
  }

  // The longest clause is the one carrying the most of the writing, and the last
  // of the long ones is where they had got to when they stopped.
  const longest = Math.max(...clauses.map(words));
  const chosen = clauses.filter((line) => words(line) === longest).pop();

  return `You wrote "${clip(chosen)}". Stay with that phrase — what sits next to it that you have not said yet?`;
}
