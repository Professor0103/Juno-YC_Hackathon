import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * Speech to text, and nothing else.
 *
 * A transcript is a draft, not a kept entry: it goes back to the client, the
 * writer edits it, and it reaches the database only if they choose to send it.
 * Persisting here would save words they never agreed to save.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Missing Authorization header' }, 401);

  let storagePath: unknown;
  try {
    ({ storagePath } = await req.json());
  } catch {
    return json({ error: 'Request body must be valid JSON' }, 400);
  }
  if (typeof storagePath !== 'string' || storagePath.length === 0) {
    return json({ error: '"storagePath" is required and must be a non-empty string' }, 400);
  }

  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!apiKey) return json({ error: 'Transcription service is not configured' }, 500);

  const supabase = createClient(
    Deno.env.get('PROJECT_URL') ?? Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('PROJECT_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  );

  // Storage RLS scopes the bucket to the caller's own {uid}/ prefix, so this
  // download is what stops one session reading another's recording.
  const { data: audioBlob, error: downloadError } = await supabase
    .storage.from('voice-notes').download(storagePath);
  if (downloadError) return json({ error: downloadError.message }, 400);

  const form = new FormData();
  form.append('file', audioBlob, 'note.webm');
  form.append('model_id', 'scribe_v2');
  form.append('tag_audio_events', 'false');
  form.append('diarize', 'false');
  form.append('no_verbatim', 'true');

  const elevenLabsRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });

  if (!elevenLabsRes.ok) {
    console.error('ElevenLabs error', elevenLabsRes.status, await elevenLabsRes.text());
    return json({ error: 'Transcription upstream request failed' }, 502);
  }

  const { text } = await elevenLabsRes.json();
  return json({ text: text ?? '' }, 200);
});
