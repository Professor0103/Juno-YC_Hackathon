# Spec: Story Narrator Edge Function (Supabase + ElevenLabs)

## Purpose
A Supabase Edge Function that accepts arbitrary text and returns narrated audio in a warm, expressive "storyteller" voice, using the ElevenLabs Text-to-Speech API. Input can be anything — a story, an article, notes — the function should always narrate it as if reading a story aloud.

## Runtime & Environment
- Supabase Edge Functions run on **Deno**, not Node — use `Deno.serve`, `fetch`, and Web APIs only (no Node-only packages).
- Store the ElevenLabs API key as a Supabase secret, never hardcoded:
  ```bash
  supabase secrets set ELEVENLABS_API_KEY=your_key_here
  ```
- Access it inside the function via `Deno.env.get("ELEVENLABS_API_KEY")`.
- The API key must never be exposed to the client — all ElevenLabs calls happen server-side inside the edge function.

## ElevenLabs API Contract
- **Endpoint**: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- **Headers**: `xi-api-key: <ELEVENLABS_API_KEY>`, `Content-Type: application/json`
- **Body**:
  ```json
  {
    "text": "the input text",
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {
      "stability": 0.35,
      "similarity_boost": 0.8,
      "style": 0.4,
      "use_speaker_boost": true
    }
  }
  ```
- **Response**: binary audio (MP3 by default). Return this directly as the edge function's response body with `Content-Type: audio/mpeg`.
- For long-form narration prefer `eleven_multilingual_v2` (or `eleven_v3` if expressive audio-tag direction is desired) over `eleven_flash_v2_5` — flash is tuned for low-latency/real-time use, not narrative quality.
- Streaming variant (`/v1/text-to-speech/{voice_id}/stream`) can be used instead if the client wants audio to start playing before generation finishes; same request body.

## Narrator Voice Settings (story-reading character)
These are the defaults this function should use so any text sounds like a narrated story rather than a flat TTS read:
| Setting | Value | Why |
|---|---|---|
| `stability` | 0.30–0.45 | Lower stability adds natural variation/expressiveness — flat stability near 1.0 sounds robotic and monotone, wrong for storytelling |
| `similarity_boost` | 0.75–0.85 | Keeps the chosen narrator voice consistent and recognizable |
| `style` | 0.3–0.5 | Adds expressive/dramatic character; only supported on certain models — omit if using a model without style support |
| `use_speaker_boost` | true | Improves clarity/presence |

Pick a `voice_id` for a narrator-style voice (either a stock ElevenLabs voice tagged for narration, or a Professional/Instant Voice Clone made from a narrator sample — see the companion voice-cloning spec if using a custom clone). Store `voice_id` as a config constant or a request parameter with a safe default.

## Request/Response Contract for This Edge Function
**Request** (`POST /functions/v1/narrate`):
```json
{
  "text": "Once upon a time...",
  "voice_id": "optional-override-voice-id"
}
```

**Response**: raw audio bytes, `Content-Type: audio/mpeg`, on success.
**Errors**: JSON `{ "error": "message" }` with appropriate HTTP status (400 for bad input, 502 for upstream ElevenLabs failure, 500 for unexpected).

## Handling Long Text
- ElevenLabs has per-request character limits depending on model (e.g. `eleven_v3` caps around 5,000 characters per request). Before calling the API:
  1. If `text.length` exceeds the model's safe limit, split into paragraph-aligned chunks (don't cut mid-sentence).
  2. Call the TTS endpoint per chunk, passing `previous_text` / `next_text` (or `previous_request_ids` / `next_request_ids`) so prosody stays continuous across chunk boundaries.
  3. Concatenate the returned audio buffers in order before returning to the client, or stream sequentially if using the streaming endpoint.
- For most story-length inputs (a few paragraphs to a few pages), chunking by paragraph with overlap context is sufficient; only invoke the multi-chunk path when text exceeds the limit.

## Function Structure (Deno / TypeScript)
```
supabase/functions/narrate/index.ts
```
Core logic outline:
1. Parse and validate the incoming JSON body (`text` required, non-empty; `voice_id` optional).
2. Reject requests with excessively long text before calling ElevenLabs (define a sane max, e.g. reject over ~50,000 characters) — the function should not silently attempt unbounded chunking.
3. Chunk if needed (see above).
4. Call ElevenLabs TTS endpoint(s) with the narrator voice settings.
5. Concatenate audio if multi-chunk.
6. Return the audio response with correct headers and CORS support for the calling client.
7. Wrap upstream calls in try/catch; on ElevenLabs error, log details server-side and return a generic error to the client (don't leak the API key or raw upstream error bodies that might contain account info).

## Security & Ops Notes
- Never accept a client-supplied API key — always use the server-side secret.
- Rate-limit or auth-gate the endpoint (e.g. require a valid Supabase user JWT) so it can't be used as an open ElevenLabs proxy and run up the account's character quota.
- Log character counts per request for cost monitoring, since ElevenLabs bills by character usage.
- Consider caching: if the same text is narrated repeatedly, store generated audio in Supabase Storage keyed by a hash of `(text, voice_id, settings)` to avoid re-billing identical requests.

## Out of Scope
- This spec does not cover ElevenLabs voice cloning/training (see the companion voice-cloning spec for that).
- Does not cover client-side playback UI — only the edge function contract and ElevenLabs integration.
