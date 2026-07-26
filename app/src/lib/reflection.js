import { CACHED_DEEPENING, SEEDED_TEXT_ID, composeFallbackQuestion } from './fallbacks.js';
import { ensureSession, supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase.js';

const FUNCTIONS = `${SUPABASE_URL}/functions/v1`;

/**
 * How long the waiting state may last before the local fallback takes over
 * (PSD 4.1). Measured to the first token, not to completion: once words are
 * appearing the wait is over, and a stream that has started is working.
 *
 * The session beat reasons at high effort, and reasoning happens before the first
 * visible token, so this is a good deal longer than a chat app would need. It is a
 * ceiling on a dead network, not an expected wait: a live turn usually starts
 * drawing well inside it.
 */
const FIRST_TOKEN_MS = 22000;

/** Pace of the fallback, so a dead network reads as the same experience. */
const FALLBACK_MS_PER_WORD = 34;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function post(name, payload, signal) {
  const session = await ensureSession();
  return fetch(`${FUNCTIONS}/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });
}

/**
 * Boot the isolate on app load so the first turn is not the request that pays for a
 * cold start while the user is watching. Failures are ignored on purpose: this
 * is an optimisation, and the session must not depend on it having worked.
 */
export function prewarm() {
  ensureSession()
    .then(() => post('reflection-deepen', { warm: true }).catch(() => {}))
    .catch(() => {});
}

async function* readFrames(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      try {
        yield JSON.parse(line);
      } catch {
        // A frame we can't read is a frame we skip, not a dead stream.
      }
    }
  }
}

async function* typeOut(text) {
  for (const chunk of text.split(/(\s+)/)) {
    if (!chunk) continue;
    if (chunk.trim()) await sleep(FALLBACK_MS_PER_WORD);
    yield chunk;
  }
}

/**
 * Runs one beat and yields events: {type:'token'}, {type:'safety'}, {type:'fallback'}.
 *
 * Three failure paths, and they are not treated the same way:
 *
 *   nothing within 8s  → abort and run the fallback
 *   error before any token → run the fallback
 *   error after tokens started → keep what arrived and stop
 *
 * The last one matters on stage. Swapping visible text for different text mid-beat
 * looks broken in a way that a slightly short question does not. The one case where
 * drawn text is thrown away is a safety flag, where throwing it away is the point.
 *
 * Which path ran is logged, so the console says which one the demo took.
 */
async function* runBeat(name, payload, fallbackText) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIRST_TOKEN_MS);
  let received = 0;

  try {
    const res = await post(name, payload, controller.signal);
    if (!res.ok || !res.body) throw new Error(`${name} returned ${res.status}`);

    for await (const frame of readFrames(res.body)) {
      if (frame.safety) {
        yield { type: 'safety' };
        return;
      }
      if (frame.error) throw new Error(frame.error);
      if (typeof frame.t !== 'string' || !frame.t) continue;

      if (received === 0) {
        clearTimeout(timer);
        console.info(`[mango] ${name}: live`);
      }
      received += 1;
      yield { type: 'token', text: frame.t };
    }

    if (received === 0) throw new Error(`${name} returned no output`);
  } catch (err) {
    clearTimeout(timer);

    if (received > 0) {
      console.warn(`[mango] ${name}: live, ended early after ${received} tokens`, err);
      return;
    }

    console.warn(`[mango] ${name}: FALLBACK`, err);
    yield { type: 'fallback' };
    for await (const chunk of typeOut(fallbackText)) yield { type: 'token', text: chunk };
  } finally {
    clearTimeout(timer);
  }
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
 * One row, written once, when the writer ends the session.
 *
 * Nothing is persisted before that. That is what makes "shows the support card and
 * writes no row anywhere" true by construction rather than by a branch somebody has
 * to remember to add: until this function is called, the session exists only in
 * React state.
 *
 * `body` holds their writing and nothing else, so the entry reads back as the thing
 * they wrote rather than as a chat log — the chat companion quotes from this column
 * and must never attribute Mango's sentence to them. Mango's turns are kept
 * alongside in deepening_question, which is why that column is now a transcript
 * rather than a single question.
 *
 * user_id comes from the session, and RLS checks it against the JWT anyway.
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
