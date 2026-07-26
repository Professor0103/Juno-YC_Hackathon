export const MODEL = 'gpt-5.6-terra';

const ENDPOINT = 'https://api.openai.com/v1/responses';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export function ndjson(produce: (send: (frame: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (frame: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));
      try {
        await produce(send);
      } catch (err) {
        console.error('stream aborted', err instanceof Error ? err.message : 'unknown');
        send({ error: 'generation_failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-store',
    },
  });
}

/** Effort levels this model family accepts. Screening runs none, the session high. */
type Effort = 'none' | 'low' | 'medium' | 'high';

/** One turn of a conversation, in the order it was said. */
export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

interface CompleteArgs {
  system: string;
  /** A single prompt. Mutually exclusive with `turns`. */
  user?: string;
  /**
   * The whole conversation so far, oldest first.
   *
   * The session beat sends this rather than `user`, and that is the difference
   * between a model that can read across turns and one that only ever sees the
   * most recent message. A close reading of turn five is mostly a reading of what
   * changed since turn one, so turn one has to be in the request.
   */
  turns?: Turn[];
  stream?: boolean;
  effort?: Effort;
  maxOutputTokens?: number;
}

export function complete(a: CompleteArgs & { stream: true }): Promise<AsyncIterable<string>>;
export function complete(a: CompleteArgs & { stream?: false }): Promise<string>;
export async function complete({
  system,
  user,
  turns,
  stream = false,
  effort = 'low',
  maxOutputTokens = 1200,
}: CompleteArgs): Promise<string | AsyncIterable<string>> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY is not set');

  const input = turns && turns.length > 0 ? turns : (user ?? '');
  if (Array.isArray(input) ? input.length === 0 : !input) {
    throw new Error('complete() needs either "user" or a non-empty "turns"');
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      instructions: system,
      input,
      stream,
      reasoning: { effort },
      max_output_tokens: maxOutputTokens,
    }),
  });

  if (!res.ok || !res.body) {
    // The body can carry the provider's own message; it must not reach the client.
    console.error('llm upstream error', res.status, await res.text().catch(() => ''));
    throw new Error(`Upstream returned ${res.status}`);
  }

  return stream ? readDeltas(res.body) : readWhole(await res.json());
}


function readWhole(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === 'string') return payload.output_text.trim();

  const output = Array.isArray(payload.output) ? payload.output : [];
  const parts: string[] = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (block?.type === 'output_text' && typeof block.text === 'string') parts.push(block.text);
    }
  }
  return parts.join('').trim();
}

async function* readDeltas(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        for (const line of frame.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(data);
          } catch {
            continue;
          }

          if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
            yield event.delta;
          } else if (event.type === 'response.failed' || event.type === 'error') {
            console.error('llm stream error', data);
            throw new Error('Upstream stream failed');
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
