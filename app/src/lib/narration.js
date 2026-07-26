import { ensureSession, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase.js';

const FUNCTIONS = `${SUPABASE_URL}/functions/v1`;

/**
 * The poem, read aloud.
 *
 * Returns audio bytes rather than a URL: the function synthesises on demand and
 * streams back audio/mpeg, so there is nothing to link to. The caller owns the
 * blob and the object URL made from it.
 */
export async function narrate(text, { voiceId, signal } = {}) {
  const session = await ensureSession();

  const res = await fetch(`${FUNCTIONS}/narrate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, voice_id: voiceId }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `narrate returned ${res.status}`);
  }

  return res.blob();
}
