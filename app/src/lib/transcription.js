import { ensureSession, supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase.js';

const FUNCTIONS = `${SUPABASE_URL}/functions/v1`;

/**
 * Speech in, draft text out.
 *
 * The recording goes to Storage rather than straight to the function because
 * ElevenLabs wants a file and an edge function body is not the place for
 * megabytes of audio. It lives under {uid}/ — the prefix storage RLS checks —
 * and is deleted as soon as there is a transcript, so a spoken message
 * outlives the moment it becomes text by about a second.
 *
 * Nothing here writes an entry. What comes back is a draft the writer can edit
 * or throw away, and it reaches the database only if they choose to send it.
 */
export async function transcribeRecording(blob) {
  const session = await ensureSession();
  const path = `${session.user.id}/${Date.now()}.webm`;

  const { error: uploadError } = await supabase
    .storage.from('voice-notes')
    .upload(path, blob, { contentType: blob.type || 'audio/webm' });
  if (uploadError) throw uploadError;

  try {
    const res = await fetch(`${FUNCTIONS}/transcribe-voice-note`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ storagePath: path }),
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error(detail?.error ?? `transcribe-voice-note returned ${res.status}`);
    }

    const { text } = await res.json();
    return text ?? '';
  } finally {
    // Best-effort: a recording left behind is a privacy cost, but failing to
    // delete it must not cost the writer the words they just spoke.
    supabase.storage.from('voice-notes').remove([path]).catch(() => {});
  }
}
