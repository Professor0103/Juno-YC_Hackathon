import { complete, CORS_HEADERS, json, ndjson, type Turn } from '../_shared/llm.ts';
import { DEEPENING } from '../_shared/prompts.ts';
import { screen } from '../_shared/safety.ts';

/**
 * The session beat — one turn back, read against everything said so far. Runs
 * for as many turns as the writer wants; only they end the session.
 *
 * verify_jwt is on, so reaching this code means the caller's JWT is already
 * validated. Nothing here reads or writes the database or takes a user id from
 * the body — the beat only needs the words in front of it, so there's no
 * service-role client and RLS never comes into it. The transcript is held by
 * the client and posted back each turn; the server keeps no session state.
 */

/** Turns past this are dropped from the head of the transcript, oldest first. */
const MAX_TURNS = 40;
const MAX_TURN_CHARS = 8_000;

/**
 * Reasoning tokens are drawn from the same budget as the reply, and this beat runs
 * at high effort. Sized so a long think cannot consume the allowance and leave the
 * writer with an empty turn.
 */
const MAX_OUTPUT_TOKENS = 4_000;

function readTurns(value: unknown): Turn[] {
  if (!Array.isArray(value)) return [];

  const turns: Turn[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const { role, content } = item as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string' || !content.trim()) continue;
    turns.push({ role, content: content.trim().slice(0, MAX_TURN_CHARS) });
  }

  return turns.slice(-MAX_TURNS);
}

/**
 * The opening text is prepended as context rather than sent as a turn, so the model
 * never mistakes it for something the writer said and quote it back as theirs.
 */
function openingContext(text: unknown): string {
  if (typeof text !== 'object' || text === null) return '';
  const { title, author, body } = text as Record<string, unknown>;
  if (typeof body !== 'string' || !body.trim()) return '';

  const credit = [title, author].filter((v) => typeof v === 'string' && v.trim()).join(' — ');

  return [
    credit
      ? `The text that opened this session — ${credit}:`
      : 'The text that opened this session:',
    '',
    body.trim(),
    '',
    '---',
    '',
    'The conversation so far follows. Everything below is the writer speaking, or you.',
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be valid JSON' }, 400);
  }

  // Pre-warm on app load (PSD 4.1), so the first real turn is never the request
  // that pays for a cold isolate while the user is sitting in the waiting state.
  if (body.warm === true) return json({ warm: true });

  const turns = readTurns(body.turns);
  const latest = [...turns].reverse().find((t) => t.role === 'user');
  if (!latest) return json({ error: '"turns" must contain at least one user turn' }, 400);

  // Started, not awaited: screening runs alongside generation rather than in front
  // of it, so it adds no wall-clock time to the session. Only the newest message is
  // screened — everything older already went through on the turn that produced it.
  const flagged = screen(latest.content);
  flagged.catch(() => {});

  const opening = openingContext(body.text);
  const input: Turn[] = opening
    ? [{ role: 'user', content: opening }, ...turns]
    : turns;

  let deltas: AsyncIterable<string>;
  try {
    deltas = await complete({
      system: DEEPENING,
      turns: input,
      stream: true,
      effort: 'high',
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
  } catch {
    // The client falls back to a question built locally from their own words.
    return json({ error: 'generation_failed' }, 502);
  }

  return ndjson(async (send) => {
    let interrupted = false;
    flagged.then((f) => { interrupted = f; }).catch(() => {});

    for await (const token of deltas) {
      if (interrupted) break;
      send({ t: token });
    }

    // Covers the case where screening lands after generation finished. The client
    // discards everything it has drawn on this turn.
    if (await flagged) send({ safety: true });
  });
});
