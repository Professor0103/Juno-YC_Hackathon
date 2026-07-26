const DEFAULT_VOICE_ID = 'NtS6nEHDYMQC9QczMQuq';
const MODEL_ID = 'eleven_multilingual_v2';
const MAX_TEXT_LENGTH = 50_000;
const CHUNK_LIMIT = 4_500;

const VOICE_SETTINGS = {
  stability: 0.35,
  similarity_boost: 0.8,
  style: 0.4,
  use_speaker_boost: true,
  speed: 0.9,
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function chunkText(text: string): string[] {
  if (text.length <= CHUNK_LIMIT) return [text];

  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > CHUNK_LIMIT && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

async function synthesizeChunk(
  voiceId: string,
  text: string,
  previousText: string | undefined,
  nextText: string | undefined,
  apiKey: string,
): Promise<ArrayBuffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: VOICE_SETTINGS,
      previous_text: previousText,
      next_text: nextText,
    }),
  });

  if (!res.ok) {
    console.error('ElevenLabs error', res.status, await res.text());
    throw new Error('Narration upstream request failed');
  }

  return res.arrayBuffer();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  let body: { text?: unknown; voice_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError('Request body must be valid JSON', 400);
  }

  const { text, voice_id } = body;
  if (typeof text !== 'string' || text.trim().length === 0) {
    return jsonError('"text" is required and must be a non-empty string', 400);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return jsonError(`"text" exceeds the ${MAX_TEXT_LENGTH} character limit`, 400);
  }

  const voiceId = typeof voice_id === 'string' && voice_id.length > 0 ? voice_id : DEFAULT_VOICE_ID;
  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!apiKey) return jsonError('Narration service is not configured', 500);

  console.log('narrate request', { characters: text.length, voiceId });

  const chunks = chunkText(text);

  try {
    const audioBuffers = await Promise.all(
      chunks.map((chunk, i) =>
        synthesizeChunk(voiceId, chunk, chunks[i - 1], chunks[i + 1], apiKey)
      )
    );

    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of audioBuffers) {
      combined.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }

    return new Response(combined, {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'audio/mpeg' },
    });
  } catch (err) {
    console.error('narrate failed', err);
    return jsonError('Narration failed', 502);
  }
});
