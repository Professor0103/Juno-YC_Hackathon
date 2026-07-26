import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const { storagePath } = await req.json();

  const supabase = createClient(
    Deno.env.get('PROJECT_URL')!,
    Deno.env.get('PROJECT_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  const { data: audioBlob, error: downloadError } = await supabase
    .storage.from('voice-notes').download(storagePath);
  if (downloadError) return new Response(JSON.stringify({ error: downloadError.message }), { status: 400 });

  const form = new FormData();
  form.append('file', audioBlob, 'note.webm');
  form.append('model_id', 'scribe_v2');
  form.append('tag_audio_events', 'false');
  form.append('diarize', 'false');
  form.append('no_verbatim', 'true');

  const elevenLabsRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY')! },
    body: form,
  });
  const { text } = await elevenLabsRes.json();

  const { data: { user } } = await supabase.auth.getUser();
  const { error: insertError } = await supabase.from('journal_entries').insert({
    user_id: user?.id,
    audio_path: storagePath,
    transcript: text,
  });
  if (insertError) return new Response(JSON.stringify({ error: insertError.message }), { status: 400 });

  return new Response(JSON.stringify({ text }), { status: 200 });
});