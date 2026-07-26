import { ensureSession, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase.js';

/**
 * The transport every AI beat shares: an authenticated POST to an edge function,
 * an NDJSON stream read frame by frame, and a local fallback so a dead network
 * degrades into something rather than into nothing (PSD 4.1).
 *
 * Lifted out of reflection.js when the journal gained a companion of its own,
 * because the two surfaces differ only in which function they call and what they
 * fall back to. Anything true of both beats belongs here; anything true of one
 * belongs beside that one.
 */

const FUNCTIONS = `${SUPABASE_URL}/functions/v1`;

/**
 * How long the waiting state may last before the local fallback takes over
 * (PSD 4.1). Measured to the first token, not to completion: once words are
 * appearing the wait is over, and a stream that has started is working.
 *
 * The session beat reasons before it speaks, and reasoning happens before the
 * first visible token, so this is a good deal longer than a chat app would need.
 * It is a ceiling on a dead network, not an expected wait.
 */
const FIRST_TOKEN_MS = 22000;

/** Pace of the fallback, so a dead network reads as the same experience. */
const FALLBACK_MS_PER_WORD = 34;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function post(name, payload, signal) {
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
 * Boot the isolates on app load so the first turn is not the request that pays
 * for a cold start while the user is watching. Both conversational surfaces are
 * warmed, because the journal is the landing mode and its first turn is the one
 * a judge sees first. Failures are ignored on purpose: this is an optimisation,
 * and neither beat may depend on it having worked.
 */
export function prewarm(...names) {
  ensureSession()
    .then(() => {
      for (const name of names) post(name, { warm: true }).catch(() => {});
    })
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
 *   nothing within FIRST_TOKEN_MS  → abort and run the fallback
 *   error before any token         → run the fallback
 *   error after tokens started     → keep what arrived and stop
 *
 * The last one matters on stage. Swapping visible text for different text mid-beat
 * looks broken in a way that a slightly short turn does not. The one case where
 * drawn text is thrown away is a safety flag, where throwing it away is the point.
 *
 * Which path ran is logged, so the console says which one the demo took.
 */
export async function* runBeat(name, payload, fallbackText) {
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
