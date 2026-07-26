import { createClient } from 'jsr:@supabase/supabase-js@2';
import { complete, CORS_HEADERS, json, ndjson, type Turn } from '../_shared/llm.ts';
import { CHAT } from '../_shared/prompts.ts';
import { screen } from '../_shared/safety.ts';

/**
 * The journal companion.
 *
 * This used to take a single `message` and answer it in isolation, and it was
 * wired to no screen. Both of those are now false: the journal calls it on every
 * turn, and it takes the whole conversation, because a companion that can only
 * see the newest message cannot follow a concern the writer raised two turns ago
 * — which is most of what makes it feel like it is listening.
 *
 * The client sends entry ids, never entry text, and the rows are read back through
 * a client built from the caller's own Authorization header. So RLS decides what
 * this function can see: asking for someone else's entry id returns zero rows
 * rather than someone else's writing. The service-role key is not used here.
 *
 * The transcript is held by the client and posted back each turn, so the server
 * keeps no session state and nothing accumulates here to leak.
 */

/** Turns past this are dropped from the head of the transcript, oldest first. */
const MAX_TURNS = 40;
const MAX_TURN_CHARS = 8_000;

/**
 * Reasoning tokens come out of the same budget as the reply. Sized so a long
 * think cannot consume the allowance and leave the writer with an empty turn.
 */
const MAX_OUTPUT_TOKENS = 2_000;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Missing Authorization header' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be valid JSON' }, 400);
  }

  // Pre-warm on app load (PSD 4.1). The journal is the landing mode, so this
  // isolate is the one whose cold start a judge would otherwise sit through.
  if (body.warm === true) return json({ warm: true });

  const turns = readTurns(body.turns);
  const latest = [...turns].reverse().find((t) => t.role === 'user');
  if (!latest) return json({ error: '"turns" must contain at least one user turn' }, 400);

  // Started, not awaited: screening runs alongside generation rather than in front
  // of it, so it adds no wall-clock time. Only the newest message is screened —
  // everything older went through on the turn that produced it. The journal now
  // reaches a model, so it gets the same second layer the session has; the local
  // pre-filter still runs in front of both.
  const flagged = screen(latest.content);
  flagged.catch(() => {});

  const entryIds = Array.isArray(body.entry_ids)
    ? body.entry_ids.filter((v): v is string => typeof v === 'string')
    : [];

  let opened = '';
  if (entryIds.length > 0) {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authorization } } },
    );

    const { data, error } = await supabase
      .from('entries')
      .select('created_at, body, artifact_body')
      .in('id', entryIds)
      .order('created_at', { ascending: true });

    if (error) return json({ error: 'Could not read those entries' }, 502);

    opened = (data ?? [])
      .map((row) => {
        const written = new Date(row.created_at).toISOString().slice(0, 10);
        return [`[${written}]`, row.body, row.artifact_body].filter(Boolean).join('\n');
      })
      .join('\n\n');
  }

  // Prepended as context rather than sent as a turn, so the model never mistakes
  // an old entry for something they just said and quote it back as current.
  const input: Turn[] = opened
    ? [
      {
        role: 'user',
        content: [
          'Past entries they have opened, for reference:',
          '',
          opened,
          '',
          '---',
          '',
          'The conversation follows. Everything below is them speaking, or you.',
        ].join('\n'),
      },
      ...turns,
    ]
    : turns;

  let deltas: AsyncIterable<string>;
  try {
    deltas = await complete({
      system: CHAT,
      turns: input,
      stream: true,
      effort: 'medium',
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
