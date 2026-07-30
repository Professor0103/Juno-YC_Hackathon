# Mango 🥭

A private narrative-medicine app for healthcare workers, built in 24 hours at [Juno's Consumer Health Hackathon](https://luma.com/londonai-m2w1) in London. Sponsored by Juno (YC P26), Anthropic, OpenAI, ElevenLabs, Supabase, Vercel and more.

Doctors have the highest suicide rate of any professional group. A survey of over 10,000 of them found that the thing actually stopping people from asking for help isn't a lack of care available. It's fear of losing confidentiality or career standing. We wanted to design for that fear directly rather than around it. Another basic wellbeing app wasn't going to cut it. This had to be private by construction rather than by policy, and it had to do something more useful than ask "how are you feeling today?"

So we built it around narrative medicine instead: the same close-reading practice clinicians are trained in, aimed at their own lives for once.

## What it does

Mango has two modes, and they're deliberately not the same thing.

**Journal** is fast capture. Type or speak, it's saved, done. This is the "parallel chart" that Rita Charon writes about: the second chart clinicians keep for everything that can't go in the medical record.

**Reflection** is slower. You're given a short poem, you write in response to it, and Mango asks one question back. It's built from your own words, and read against the whole conversation so far rather than just your last message. It'll notice a word you used early and then dropped, a name that keeps almost coming up, a thing you said three turns ago that this connects to. You end it whenever you want, and what you wrote is kept, in your own words.

Any Journal entry can be turned into a Reflection later. 

A few things we thought mattered enough to build properly rather than fake for the demo:

- **A real crisis-safety layer.** A local pattern-matcher, tuned specifically against this population's ordinary language ("we lost him to an overdose" is clinical narration, not a crisis; "I hurt myself last night" is), backing up a second model-based screen. If something looks self-directed, the AI stops mid-sentence and shows crisis resources instead. Nothing about that moment is logged, flagged, or stored anywhere.
- **Privacy that's actually true.** Anonymous auth, no email, no employer link, nothing that identifies you sent anywhere except the words themselves going to the model that answers you. We were careful not to oversell this. An honest "not stored under your name" beats a dishonest "never leaves your device."
- **A tone that isn't a wellness app's tone.** No praise, no "that sounds hard," no silver linings. The system prompt is fought over more than any UI in this repo, because reassurance is what stops people actually processing something, which is the opposite of the point.

## Under the hood

- **React + Vite** on the frontend.
- **Supabase** for auth (anonymous sessions), Postgres with row-level security so a user's JWT is the only thing that can read their own rows, Storage, and Edge Functions.
- **OpenAI** for the two things that need a model: the Reflection question, and a background safety classifier running in parallel with it.
- **ElevenLabs** for voice input and for reading Mango's responses back out loud.

Everything that costs money or touches a model lives server-side in a Deno edge function, never in the client bundle. There's a build-time check that fails the build outright if a key ever ends up in shipped JS.

## Running it

```bash
# frontend
cd app
npm install
npm run dev

# backend (from repo root)
cd backend
npm install
npm run supabase:start   # local Supabase stack
```

You'll need your own Supabase project and an `OPENAI_API_KEY` / `ELEVENLABS_API_KEY` set as edge function secrets. See `app/.env.example` and `backend/.env.example`. Nothing runs against our project. It's anonymous auth on purpose, but it's still our infrastructure.

## What's real and what's a demo

Built this fast, so a few things are honestly labelled rather than pretended. The calendar and analytics page run on seeded example data, not a real history. Text selection for Reflection only picks between one poem right now: the routing logic exists, the library doesn't yet. The schema has a slot for a distilled "artifact" pulled from a kept session (a single line, in your own words, the way the seeded example entries show it), but the composition step for that isn't wired up yet, so today a kept Reflection is the session itself. 

## Team

Built by Brandon, Shaz, and Seb. Built in a night with KFC and no sleep. 

## License

MIT, see [LICENSE](LICENSE).
