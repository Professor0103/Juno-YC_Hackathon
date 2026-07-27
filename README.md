# Mango 🥭

A private narrative-medicine app for healthcare workers, built in about 36 hours at [Juno's Consumer Health Hackathon](https://luma.com/londonai-m2w1) in London.

Doctors have the highest suicide rate of any professional group, and a survey of over 10,000 of them found that fear of losing confidentiality or career standing — not lack of care — is what actually stops people asking for help. We designed for that fear directly rather than around it. This couldn't be another wellbeing app with mood rings and streaks; it had to be private by construction, not by policy, and it had to do something more useful than asking "how are you feeling today?"

We built it around narrative medicine instead: the same close-reading practice clinicians are trained in, aimed at their own lives for once.

## What it does

Mango has two modes, and they're deliberately not the same thing.

**Journal** is fast capture. Type or speak, it's saved, done. No prompt, no AI, nothing standing between a bad shift and getting it out of your head. This is the "parallel chart" — the second chart Rita Charon writes about, the one clinicians keep for everything that can't go in the medical record.

**Reflection** is slower. You're given a short poem, you write in response to it, and Mango asks one question back — not generic, built from your own words and read against the whole conversation so far, not just your last message. It'll notice a word you used early and dropped, a name that keeps almost coming up, a thing you said three turns ago that this connects to. You end it whenever you want, and what you wrote is kept, in your own words.

Any Journal entry can be turned into a Reflection later. That's the actual product: capture now, make sense of it later, in your own time.

A few things we thought mattered enough to build properly rather than fake for the demo:

- **A real crisis-safety layer.** A local pattern-matcher, tuned specifically against this population's ordinary language ("we lost him to an overdose" is clinical narration, not a crisis; "I hurt myself last night" is), backing up a second model-based screen. If something looks self-directed, the AI stops mid-sentence and shows crisis resources instead — and nothing about that moment is logged, flagged, or stored anywhere.
- **Privacy that's actually true.** Anonymous auth, no email, no employer link, nothing that identifies you sent anywhere except the words themselves going to the model that answers you. We were careful not to oversell this — an honest "not stored under your name" beats a dishonest "never leaves your device."
- **A tone that isn't a wellness app's tone.** No praise, no "that sounds hard," no silver linings. The system prompt is fought over more than any UI in this repo — reassurance is what stops people actually processing something, which is the opposite of the point.

## Under the hood

- **React + Vite**, no framework beyond that — the whole thing is one composed illustration you write inside of, so most of the interesting work is in measuring things (contrast ratios, viewport height under a mobile keyboard, where an animated bear's feet land on a cropped image) rather than in components.
- **Supabase** for auth (anonymous sessions), Postgres (row-level security — a user's JWT is the only thing that can ever read their own rows), Storage, and Edge Functions.
- **OpenAI** for the two things that need a model: the Reflection question, and a background safety classifier running in parallel with it.
- **ElevenLabs** for voice input and for reading Mango's responses back out loud.

Everything that costs money or touches a model lives server-side in a Deno edge function, never in the client bundle — there's a build-time check that fails the build outright if a key ever ends up in shipped JS.

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

You'll need your own Supabase project and an `OPENAI_API_KEY` / `ELEVENLABS_API_KEY` set as edge function secrets — see `app/.env.example` and `backend/.env.example`. Nothing runs against our project; it's anonymous auth on purpose, but it's still our infrastructure.

## What's real and what's a demo

Built this fast, a few things are honestly labelled rather than pretended: the calendar and analytics page run on seeded example data, not a real history. Text selection for Reflection only picks between one poem right now — the routing logic exists, the library doesn't yet. The schema has a slot for a distilled "artifact" pulled from a kept session (a single line, in your own words, the way the seeded example entries show it) — the composition step for that isn't wired up yet, so today a kept Reflection is the session itself. We say so on-screen where it matters, because judges — and anyone reading this later — notice the difference between a real feature and a well-lit mockup faster than you'd hope.

## Team

Built by Brandon, Shaz, and Seb over one very long weekend, powered by whatever the venue's coffee machine was doing.

## License

MIT — see [LICENSE](LICENSE).
