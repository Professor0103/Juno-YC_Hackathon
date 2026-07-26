import { createClient } from 'jsr:@supabase/supabase-js@2';
import { complete, CORS_HEADERS, json, ndjson } from '../_shared/llm.ts';
import { CHAT } from '../_shared/prompts.ts';

/**
 * The entry-companion surface.
 *
 * Not wired to a screen in slice 1 — the Reflection arc has no chat beat — but the
 * prompt and the retrieval rule are the parts worth fixing now.
 *
 * The client sends entry ids, never entry text, and the rows are read back through
 * a client built from the caller's own Authorization header. So RLS decides what
 * this function can see: asking for someone else's entry id returns zero rows
 * rather than someone else's writing. The service-role key is not used here.
 */
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

  if (body.warm === true) return json({ warm: true });

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const entryIds = Array.isArray(body.entry_ids) ? body.entry_ids.filter((v) => typeof v === 'string') : [];
  if (!message) return json({ error: '"message" is required' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  );

  let opened = '';
  if (entryIds.length > 0) {
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

  const user = [
    opened ? `Entries they have opened:\n\n${opened}` : 'They have opened no entries.',
    `Their message:\n\n${message}`,
  ].join('\n\n---\n\n');

  let deltas: AsyncIterable<string>;
  try {
    deltas = await complete({ system: CHAT, user, stream: true });
  } catch {
    return json({ error: 'generation_failed' }, 502);
  }

  return ndjson(async (send) => {
    for await (const token of deltas) send({ t: token });
  });
});
