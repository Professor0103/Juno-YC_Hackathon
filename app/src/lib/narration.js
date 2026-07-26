import { post } from './beat.js';

/**
 * The poem, read aloud.
 *
 * Returns audio bytes rather than a URL: the function synthesises on demand and
 * streams back audio/mpeg, so there is nothing to link to. The caller owns the
 * blob and the object URL made from it.
 */
export async function narrate(text, { voiceId, signal } = {}) {
  const res = await post('narrate', { text, voice_id: voiceId }, signal);

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `narrate returned ${res.status}`);
  }

  return res.blob();
}
