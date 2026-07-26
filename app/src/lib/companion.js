import { runBeat } from './beat.js';
import { composeFallbackQuestion } from './fallbacks.js';

/**
 * The journal companion (PSD 3.2 as amended).
 *
 * The journal used to answer with composeFallbackQuestion() directly — the local
 * clause-picker written as the offline fallback for the session beat. It never
 * touched a model, so it could not read across turns, could not follow a concern
 * from one entry into the next, and said the same shape of sentence every time.
 * That is what made the companion read as cold: it was not a companion, it was a
 * string function wearing one's clothes.
 *
 * It now calls the `chat` function with the whole conversation, and keeps the
 * clause-picker where it belongs — as the thing that speaks when the network
 * does not.
 *
 * @param {object} args
 * @param {Array<{role: 'user'|'assistant', content: string}>} args.turns oldest first
 * @param {string[]} [args.entryIds] past entries the writer has opened, by id only
 */
export function converse({ turns, entryIds = [] }) {
  const latest = [...turns].reverse().find((turn) => turn.role === 'user');

  return runBeat(
    'chat',
    { turns, entry_ids: entryIds },
    composeFallbackQuestion(latest?.content),
  );
}
