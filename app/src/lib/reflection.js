import { runBeat } from './beat.js';
import { CACHED_DEEPENING, SEEDED_TEXT_ID, composeFallbackQuestion } from './fallbacks.js';
import { ensureSession, supabase } from './supabase.js';

/** The one text in the library. Slice 1 does not choose between texts. */
export async function loadOpeningText() {
  await ensureSession();
  const { data, error } = await supabase
    .from('texts')
    .select('id, title, author, body, year_published, rights_note')
    .eq('id', SEEDED_TEXT_ID)
    .single();

  if (error) throw error;
  return data;
}

/**
 * One turn of the session.
 *
 * The whole transcript goes up every turn. The server holds no session state, so
 * what the model can read across is exactly what the client chose to send — and
 * when the session ends, there is nothing on the server to have kept.
 *
 * @param {object} args
 * @param {object|null} args.text the opening text, for context
 * @param {Array<{role: 'user'|'assistant', content: string}>} args.turns oldest first
 */
export function deepen({ text, turns }) {
  const opening = turns.filter((turn) => turn.role === 'assistant').length === 0;
  const latest = [...turns].reverse().find((turn) => turn.role === 'user');

  const fallback = opening
    ? CACHED_DEEPENING[text?.id] ?? CACHED_DEEPENING[SEEDED_TEXT_ID]
    : composeFallbackQuestion(latest?.content);

  return runBeat(
    'reflection-deepen',
    { text: text ? { title: text.title, author: text.author, body: text.body } : null, turns },
    fallback,
  );
}

/**
 * One row, written once, when the writer ends the session. Nothing is
 * persisted before this is called — the session exists only in React state
 * until then, so an abandoned session leaves nothing behind by construction.
 *
 * `body` holds only what the writer wrote, never Mango's side of it, so an
 * entry reads back as their own words. Mango's turns live alongside in
 * deepening_question.
 */
export async function saveReflection({ textId, turns }) {
  const session = await ensureSession();

  const said = (role) =>
    turns
      .filter((turn) => turn.role === role && turn.content.trim())
      .map((turn) => turn.content.trim())
      .join('\n\n');

  const { data, error } = await supabase
    .from('entries')
    .insert({
      user_id: session.user.id,
      mode: 'reflection',
      input_method: 'text',
      text_id: textId,
      body: said('user'),
      deepening_question: said('assistant') || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
}
