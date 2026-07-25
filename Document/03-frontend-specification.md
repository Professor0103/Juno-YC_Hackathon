# Mango — Front-End Specification

**Companion to:** `02-product-specification-document.md` (PSD). Where this document and the PSD disagree, the PSD wins on *what gets built*; this document wins on *how it looks and behaves*. Conflicts found so far are logged in §18.

**Audience:** the coding agent, and the designer reviewing its output.

**Status:** v0.1. Scoped to the **home screen** and the components it depends on. Onboarding and the loading screen are stubbed in §9.4 and specified later.

---

## 0. How to use this document

Read §3 (principles), §5 (tokens) and §9 (home screen) before writing any code. §5 is paste-ready CSS — do not re-derive colours or type sizes, and do not introduce values that aren't in it. If something is genuinely missing, add it to §18 rather than inventing it inline.

Every rule here has a reason attached. If a rule blocks you, the reason tells you what it was protecting, and you can propose an alternative that protects the same thing.

---

## 1. Scope

**In scope for this version**

- Home screen: served text, composer, voice affordance, archive lip
- Entry card, folder chip, date stamp
- The auto-organising behaviour, as a UI contract
- Safety interruption UI
- Design tokens, type system, motion system
- Empty / loading / error / offline states
- Accessibility floor and microcopy rules

**Out of scope for this version**

- Loading screen and onboarding (stubbed, §9.4)
- Session beats 3 and 4 as full screens — the tokens and components here must support them, but their layouts come next
- Settings, purchase, anything account-shaped

---

## 2. Product context, compressed

A private, phone-first narrative medicine session for healthcare staff experiencing burnout. Roughly five minutes: read a short text closely, respond in your own words, get one question that takes you further in, leave with something you keep.

Three facts about the user drive every decision below:

1. **They have just come off a shift.** Cognitive budget is near zero. Structure is the product's job, not theirs.
2. **They are avoiding being seen.** Not by accident — the PSD is explicit that the enterprise channel is the thing they're actively avoiding. The interface must never look like something that reports.
3. **They are not the audience for encouragement.** They are professionally fluent in wellbeing language and immune to it. No congratulation, no streaks, no "well done for showing up."

**What it is not:** therapy, crisis intervention, a diagnostic tool, an employer dashboard.

---

## 3. Design principles

**3.1 The text arrives before the field.**
PSD success criterion 2 and risk 1: in silhouette this is a journaling app, and that is the single largest product risk. The mitigation is a layout rule, not a feature. On any screen where the user can write, something to read is already on screen and above it. Never render a composer as the topmost element.

**3.2 One path, no menu.**
PSD risk 2: a mode picker recreates exactly what the incumbents are criticised for. Flexibility lives in *how* you enter — type or speak — never in *what happens next*. No "choose an exercise." No home dashboard of options.

**3.3 The interface is quiet enough to be read over.**
The user is doing close reading and their own writing. Every pixel competes with that. No decorative motion inside the reading or writing area, no ambient effects behind text, no illustration next to a poem.

**3.4 The machine's voice is visually distinct from the user's.**
The user's words, the literature's words, and the system's words get three different typefaces (§6.1). This is the product's structural honesty made visible: at a glance you can see what you wrote and what was written for you.

**3.5 Nothing counts anything.**
No streaks, no completion percentages, no mood scores, no sentiment badges, no "5 day run." PSD risk 6 rules out streaks explicitly; the rest follow from the same reasoning — this audience has enough obligations and enough people measuring them.

**3.6 Warm, not soft-focus.**
The palette is warm and the motion is gentle, but the interface is precise. Sharp alignment, exact spacing, real hierarchy. Warmth comes from colour and type; it must never come from vagueness.

---

## 4. Aesthetic direction

**Direction: "warm room, late shift."**

A peach-and-clay ground with a paler paper surface set into it, cool sage and haze reserved for the parts of the app that hold *the past*. The temperature split is structural, not decorative: **warm = now, where you write; cool = kept, where things have settled.** A user can tell which room they are in with the screen at arm's length.

Type carries the personality: a rounded, hand-drawn display face used sparingly against a low-contrast literary serif and a quiet grotesque.

### 4.1 Signature element — "the settling"

The one moment the product should be remembered by. When the user finishes an entry and the agent files it, the entry card does not disappear and reappear elsewhere. It **settles**: the card lifts a few pixels, its ground cools from `--paper` toward `--haze` over ~700ms, and the folder name types itself in Daywalker beneath it — then the card comes to rest. One orchestrated moment, ~1.4s total, at the emotional centre of the product.

Everything around it stays still. Spend the boldness here and nowhere else.

**Why this and not something else:** the auto-organising agent is the genuinely novel mechanic, and "it found its own place" is what makes it feel like care rather than filing. It also gives the temperature split its meaning — you watch something move from *now* to *kept*.

---

## 5. Design tokens

Paste this as `tokens.css`. Every colour and size in the app resolves to one of these.

```css
:root {
  /* ─── Palette (specified) ─────────────────────────────── */
  --peach: #F2D2C2;   /* page ground */
  --clay:  #C6A894;   /* rules, borders, inactive, folder spines */
  --stone: #6D6E71;   /* dates and meta only */
  --haze:  #D0DDD7;   /* the archive — "kept" temperature */
  --sage:  #A3BFB3;   /* folder chips, settled markers, dividers in archive */
  --moss:  #648E7B;   /* primary action, focus ring, the agent's voice */

  /* ─── Derived additions (see §5.1 — required, not optional) ─ */
  --paper:    #FAEBE2; /* writing + reading surface */
  --ink:      #2E3A34; /* body text */
  --ink-soft: #4A5B52; /* secondary text */

  /* ─── Alpha overlays — use these, don't invent new solids ── */
  --rule:      rgba(198, 168, 148, 0.55); /* clay hairline */
  --rule-firm: rgba(198, 168, 148, 0.85);
  --scrim:     rgba(46, 58, 52, 0.32);    /* ink @32%, modal backdrop */
  --lift:      rgba(46, 58, 52, 0.08);    /* shadow colour */

  /* ─── Type ────────────────────────────────────────────── */
  --font-display: "Daywalker", "Comic Neue", cursive;
  --font-read:    "Newsreader", Georgia, serif;
  --font-ui:      "Hanken Grotesk", system-ui, sans-serif;

  --t-display: 2.75rem;  /* 44px — wordmark, screen titles */
  --t-title:   1.75rem;  /* 28px — prompts, folder names */
  --t-read:    1.1875rem;/* 19px — served text, user's writing */
  --t-body:    1.0625rem;/* 17px — general body */
  --t-ui:      0.9375rem;/* 15px — buttons, labels */
  --t-meta:    0.8125rem;/* 13px — dates, counts, attribution */

  --lh-display: 1.15;
  --lh-title:   1.25;
  --lh-read:    1.7;
  --lh-body:    1.55;
  --lh-ui:      1.4;

  --ls-meta: 0.06em;  /* meta is the only tracked text */

  /* ─── Space (4px base) ────────────────────────────────── */
  --s1: 4px;   --s2: 8px;   --s3: 12px;  --s4: 16px;
  --s5: 24px;  --s6: 32px;  --s7: 48px;  --s8: 64px;  --s9: 96px;

  /* ─── Radius ──────────────────────────────────────────── */
  --r-sm: 4px;   --r-md: 10px;  --r-lg: 18px;
  --r-xl: 28px;  --r-pill: 999px;

  /* ─── Elevation ───────────────────────────────────────── */
  --e0: none;
  --e1: 0 1px 2px var(--lift);
  --e2: 0 4px 14px var(--lift);
  --e3: 0 10px 30px var(--lift);   /* settling card at apex only */

  /* ─── Motion ──────────────────────────────────────────── */
  --d-instant: 120ms;
  --d-quick:   200ms;
  --d-gentle:  380ms;
  --d-slow:    700ms;
  --d-settle:  1400ms;  /* the signature */
  --d-breath:  9600ms;  /* ambient tempo */

  --ease-out:  cubic-bezier(0.22, 0.61, 0.36, 1);
  --ease-soft: cubic-bezier(0.4, 0.0, 0.2, 1);
  --ease-in:   cubic-bezier(0.55, 0.06, 0.68, 0.19);

  /* ─── Layout ──────────────────────────────────────────── */
  --gutter: var(--s5);
  --max-read: 34rem;   /* reading measure cap */
  --tap-min: 44px;
}
```

### 5.1 Why `--paper`, `--ink` and `--ink-soft` had to be added

The six specified colours do not contain an accessible text colour. Measured against the warm grounds:

| Text colour | on `--peach` | on `--paper` | Verdict |
|---|---|---|---|
| `--moss` #648E7B | 2.59 | 3.17 | Fails body text. Large text (≥24px) only. |
| `--stone` #6D6E71 | 3.59 | 4.55 | Fails body on peach. Passes on paper. |
| `--sage` #A3BFB3 | 1.39 | 1.76 | Never text. |
| `--ink` #2E3A34 | **8.34** | **10.19** | Passes AAA. |
| `--ink-soft` #4A5B52 | **5.08** | **6.20** | Passes AA body. |

`--ink` is `--moss` darkened along its own hue, so it belongs to the family rather than reading as imported black. `--paper` is `--peach` lightened — a full screen of `#F2D2C2` is too saturated to read a poem on for five minutes, so peach becomes the *room* and paper becomes the *page* set into it.

**Rules that follow:**
- Body text is `--ink`. Secondary is `--ink-soft`. Dates and meta are `--stone`, and only on `--paper`.
- `--moss` is permitted as text only at `--t-title` and above, and as icon/border colour at any size (3:1 is sufficient for non-text UI).
- `--sage` and `--haze` are never text colours. Ever.

### 5.2 Colour role map

| Token | Where it appears | Where it must not |
|---|---|---|
| `--peach` | Page ground, home screen | Behind long-form reading |
| `--paper` | Served text card, composer, entry cards | The archive room |
| `--clay` | Hairlines, dividers, closed folder spines, disabled states | Anything interactive-looking |
| `--stone` | Dates, counts, attribution, word count | Anything the user must read to proceed |
| `--haze` | Archive screen ground, settled entry cards | The writing surface |
| `--sage` | Folder chips, settled markers, archive dividers | Text, primary actions |
| `--moss` | Primary button, focus ring, voice control, agent's speech | Body-sized text |

---

## 6. Typography

### 6.1 Three faces, three voices

The split is semantic. Do not use these interchangeably.

| Face | Voice | Used for |
|---|---|---|
| **Daywalker** | Mango's own | Wordmark, screen titles, prompts to the user, folder names as they type themselves |
| **Newsreader** | The literature's, and the user's | Served texts, the composer, the user's saved entries, the beat-4 artifact |
| **Hanken Grotesk** | The system's | Buttons, labels, dates, counts, settings, errors, everything chrome |

**Why the user and the literature share a face:** in narrative medicine the user's response is not a reply *to* the text, it's writing *of the same kind*. Setting both in Newsreader — the served text in italic, the user's in roman — says that visually. It's also the cheapest possible way to signal "this is not a form."

**Why Newsreader and not a high-contrast display serif:** Playfair/Fraunces on a warm cream ground is currently the single most recognisable AI-generated look, and this brief already lands in warm-cream territory via the palette. Newsreader is low-contrast, screen-designed, variable, with optical sizing — it reads better at 19px on a phone and it doesn't carry the tell.

### 6.2 Daywalker: hard constraints

The font was inspected directly. Two findings the coding agent must design around:

**(a) It is a single weight.** One Regular cut. No bold, no italic, no variable axes. Never apply `font-weight: 700` or `font-style: italic` to Daywalker — the browser will synthesise them and they look broken. Hierarchy within Daywalker comes from **size only**.

**(b) Glyph coverage is incomplete.** 107 glyphs / 162 codepoints. Present: curly quotes, straight quotes, é and common accents, all Latin basic. **Missing: em dash (—), en dash (–), ellipsis (…), pound sign (£).**

This is disqualifying for the served-text role. Poetry runs on em dashes and ellipses — a Dickinson poem set in Daywalker would render tofu on nearly every line, and the fallback substitution mid-line looks worse than not using the face at all. It also can't be used for any pricing copy.

**Therefore: Daywalker is restricted to the wordmark, screen titles, prompts, and folder names — all short, all author-controlled strings.** Never bind it to user-generated or library content. Add a lint rule if you can: any Daywalker-classed element rendering `\u2014 \u2013 \u2026 \u00A3` is a bug.

### 6.3 Licence — blocking for launch, not for demo

Daywalker is **1001Fonts Free For Personal Use**. Clause 3 lists "mobile apps for companies" and "anything that will generate direct or indirect income" as commercial use requiring written permission from the author (Tokokoo). PSD §1 makes individual purchase a product requirement — so shipping Mango commercially with this font, unlicensed, is a breach.

- **Hackathon demo:** fine. Non-commercial.
- **Launch:** requires a commercial licence from Tokokoo, or a substitute.
- **Permitted now:** conversion to WOFF2 (clause 5), embedding in a personal-use app (clause 7).
- **Not permitted:** modifying or subsetting the font (clause 4), or serving the raw file for download (clause 6).

This is the same discipline the PSD applies to the text library in §3.3 and risk 8. Carried to §18 as an open item.

Note that clause 4 forbids modification, which means **you cannot subset Daywalker to reduce its file size.** Ship the whole 33KB WOFF2. That's small enough not to matter.

### 6.4 Type scale in use

| Role | Face | Size | Line height | Colour |
|---|---|---|---|---|
| Wordmark | Daywalker | `--t-display` | `--lh-display` | `--moss` |
| Screen title | Daywalker | `--t-display` | `--lh-display` | `--ink` |
| Prompt to user | Daywalker | `--t-title` | `--lh-title` | `--ink` |
| Served text | Newsreader italic | `--t-read` | `--lh-read` | `--ink` |
| User's writing | Newsreader roman | `--t-read` | `--lh-read` | `--ink` |
| Body | Newsreader | `--t-body` | `--lh-body` | `--ink` |
| Button / label | Hanken Grotesk 500 | `--t-ui` | `--lh-ui` | context |
| Date / meta | Hanken Grotesk 400 | `--t-meta` | `--lh-ui` | `--stone`, `--ls-meta`, uppercase |

Meta is the only text that is tracked or uppercased. Nothing else.

### 6.5 Loading

```css
@font-face {
  font-family: "Daywalker";
  src: url("/fonts/Daywalker.woff2") format("woff2");
  font-weight: 400;      /* declare 400 only — prevents synthesis */
  font-style: normal;
  font-display: swap;
}
```

Newsreader and Hanken Grotesk from Google Fonts, variable, weights 200–700 for Newsreader (needs italic), 400–600 for Hanken Grotesk. Preload Daywalker — it renders in the wordmark on first paint, and a swap on the app's own name is visible.

A converted `Daywalker.woff2` (33KB) is supplied alongside this document.

---

## 7. Motion

Register: **soft and breathing.** Slow, few, and always in service of continuity — never announcing itself.

### 7.1 Rules

| Situation | Duration | Easing | Properties |
|---|---|---|---|
| Focus / hover / press | `--d-instant` | `--ease-soft` | colour, border |
| Button state, chip toggle | `--d-quick` | `--ease-out` | transform, opacity |
| Element entering | `--d-gentle` | `--ease-out` | opacity + translateY(8px→0) |
| Screen transition | `--d-slow` | `--ease-out` | crossfade, no slide |
| The settling | `--d-settle` | see §11.3 | orchestrated |
| Ambient | `--d-breath` | `--ease-soft` | opacity 0.85↔1.0 max |

### 7.2 Where motion is forbidden

- Behind or around text the user is reading or writing. Nothing moves within 24px of an active composer.
- The served text card. It fades in once on load, then it is still.
- Anything during the safety interruption (§13). That screen does not animate.

### 7.3 Ambient

One ambient effect only, on the home screen: a very slow warm gradient drift on the page ground, `--d-breath` cycle, opacity range no wider than 0.85–1.0. If it's perceptible as movement, it's too strong. Off entirely once the composer has focus.

### 7.4 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

The settling still happens under reduced motion, but as a **crossfade only** — the card changes ground colour and the folder name appears, with no translation and no lift. The information survives; the choreography doesn't.

---

## 8. Layout

Mobile-first. Design target **380px**; support 320–430px; degrade gracefully to tablet by capping content at `--max-read` and centring. No desktop layout in this version.

- Horizontal gutter `--gutter` (24px), consistent on every screen.
- Vertical rhythm in multiples of `--s3` (12px).
- Reading measure never exceeds `--max-read` (~34rem), even on wide screens.
- Safe areas: `padding-bottom: max(var(--s5), env(safe-area-inset-bottom))` on any fixed bottom element.
- Minimum tap target `--tap-min` (44px) with at least 8px between adjacent targets.
- The keyboard is the primary layout hazard. Use `100dvh`, never `100vh`, and use `visualViewport` to keep the composer's caret line above the keyboard.

---

## 9. Screen: Home

### 9.1 Resolution of the PSD conflict

The brief asks for a diary-like home screen where the user types straight into the page. PSD success criterion 2 requires that a receptive text arrive before any blank input field does.

**Both are satisfiable in one screen, and this spec does that:** the served text card is the topmost element, the composer sits directly beneath it in the same scroll, and the composer is *reachable without navigation but not first*. The user can begin writing in one tap. The first thing on the screen is still something to read.

This is a design decision, not a settled product decision. It needs sign-off — §18, D1.

### 9.2 Anatomy

```
┌────────────────────────────────┐  380
│                                │
│  mango              THU 23 JUL │  ← wordmark (Daywalker/moss)
│                                │     date (Hanken/stone/meta)
│  ┌──────────────────────────┐  │
│  │                          │  │  ← SERVED TEXT
│  │  Hope is the thing with  │  │     --paper, --r-lg, --e1
│  │  feathers that perches   │  │     Newsreader italic 19/1.7
│  │  in the soul             │  │
│  │                          │  │
│  │  EMILY DICKINSON  1861   │  │  ← attribution, meta/stone
│  └──────────────────────────┘  │
│                                │
│  ──────────────────────────    │  ← hairline, --rule
│                                │
│  What's here, after that?      │  ← prompt, Daywalker 28/ink
│                                │
│  ┌──────────────────────────┐  │
│  │                          │  │  ← COMPOSER
│  │  ▏                       │  │     --paper, --r-lg, inset
│  │                          │  │     Newsreader roman 19/1.7
│  │                          │  │     autogrows, min 5 lines
│  │                    ( ● ) │  │  ← voice control, --moss
│  └──────────────────────────┘  │
│                                │
│                    [  Keep  ]  │  ← primary, appears on input
│                                │
│  ╭────────────────────────────╮│  ← ARCHIVE LIP, --haze
│  │  ⌃  24 kept · 6 folders    ││     peeks 56px above fold
└──┴────────────────────────────┴┘
```

### 9.3 Element specs

**Header.** Wordmark left, today's date right, both on `--peach`, no bar, no border. Header is not sticky — it scrolls away. Nothing on this screen needs to be persistently available.

**Served text card.** `--paper`, `--r-lg`, `--e1`, padding `--s5`. Fades in over `--d-gentle` on load, then still. Long texts truncate at ~8 lines with a "read the rest" affordance rather than scrolling inside the card. Attribution is always present — the library's rights position (PSD §3.3) depends on being able to show provenance.

**Hairline.** 1px `--rule`, full gutter width. This is the seam between *given to you* and *yours*. It is the only divider on the screen; don't add more.

**Prompt.** Daywalker, `--t-title`, `--ink`. Author-controlled string, short, varies with the served text. Never a question with a right answer. Never "how are you feeling today?" — see §16.

**Composer.** `--paper`, `--r-lg`, inset shadow `inset 0 1px 2px var(--lift)`, min-height 5 lines, autogrows to a max of 60dvh then scrolls internally. Placeholder is `--ink-soft` at 55% opacity and disappears on focus, not on input. No character counter, no word count while writing — a count may appear in the meta line *after* the entry is kept, never during.

**Voice control.** Bottom-right inside the composer, 44px circle, `--moss`. States in §10.4. Text remains available at all times; voice never replaces the keyboard (PSD risk 9 — text is the reliability floor).

**Keep button.** Hidden until the composer has content. `--moss` ground, `--paper` label, `--r-pill`, Hanken 500. Label is "Keep" — the same word as the archive count ("24 kept") and the toast ("Kept"). One action, one word, all the way through.

**Archive lip.** `--haze` ground, `--r-xl` top corners only, 56px visible above the fold. Announces that a cooler room exists below without ever being the first thing seen. Tapping or dragging it opens the archive (§12).

### 9.4 Loading screen and onboarding — stub

Out of scope for this version. Two constraints to build toward so nothing has to be undone:

- Whatever the loading screen shows, the **first content screen after it is the home screen as specified above** — served text first. Onboarding must not end on an empty composer.
- Onboarding must not ask for a name, a role, an employer, or a "what brings you here" selection. PSD §1: the thing this user is avoiding is being identified. Every question asked at the door is a reason to close the tab.

---

## 10. Components

### 10.1 Entry card

The user's kept writing, in Newsreader roman on `--paper` (unfiled) or `--haze` (settled). Meta line: date, folder chip, word count — Hanken meta, `--stone`. No preview truncation shorter than 3 lines; a two-word entry is a legitimate entry and should not look like an error.

### 10.2 Folder chip

`--sage` ground, `--ink` label, `--r-pill`, Hanken 500 `--t-meta`. Always tappable — tapping filters the archive to that folder. Always editable — see §11.4.

### 10.3 Date stamp

Hanken 400, `--t-meta`, `--stone`, uppercase, `--ls-meta`. Format `THU 23 JUL` for the current year, `23 JUL 2025` for prior years. Relative dates ("2 days ago") are permitted only within 48 hours. Never "1,247 days ago" — nothing counts (§3.5).

### 10.4 Voice control states

| State | Appearance | Motion |
|---|---|---|
| Idle | `--moss` circle, mic glyph | none |
| Requesting permission | `--clay` circle, disabled | none |
| Listening | `--moss`, ring at 1.5px expanding on amplitude | responds to input level, not a fake pulse |
| Transcribing | `--moss`, ring rotating slowly | `--d-slow` cycle |
| Failed | `--clay` circle, message below | none |

Failure message: *"Voice didn't come through. The keyboard's still here."* — states what happened, points at the fix, doesn't apologise (§16).

### 10.5 Buttons

| Variant | Ground | Label | Border |
|---|---|---|---|
| Primary | `--moss` | `--paper` | none |
| Secondary | transparent | `--ink` | 1px `--rule-firm` |
| Quiet | transparent | `--ink-soft` | none |

All `--r-pill`, min-height 44px, horizontal padding `--s5`. Focus ring: `outline: 2px solid var(--moss); outline-offset: 3px` — always visible, never removed.

---

## 11. The auto-organising agent — UI contract

### 11.1 What the user sees

They write. They tap Keep. The entry settles into a folder that already exists, or into a new one the agent names. They never choose a folder, and they never see the agent thinking.

### 11.2 States

| State | Duration | UI |
|---|---|---|
| Keeping | 0–400ms | Button label → "Keeping", composer locks |
| Sorting | 400ms–2s | Entry card visible on `--paper`, folder area shows a slow Daywalker cursor |
| Settling | 1.4s | §11.3 |
| Settled | — | Card on `--haze`, folder chip present |
| Sort failed | — | Card kept on `--paper`, chip reads "Unfiled", tappable to file manually |

**The entry is saved before the sort runs.** A failed sort must never lose writing. If the model call fails, the entry lands in "Unfiled" and the user is told once, quietly.

**Latency budget: 2s.** Past that, settle the card into "Unfiled" and let the sort complete in the background, re-settling when it lands. Never hold the user on a spinner — PSD §4.1 is explicit that a slow call is fatal to a five-minute session.

### 11.3 The settling — choreography

| t | What |
|---|---|
| 0ms | Card lifts: `translateY(-6px)`, `--e1` → `--e3`, over 260ms `--ease-out` |
| 200ms | Ground crossfades `--paper` → `--haze` over 500ms `--ease-soft` |
| 500ms | Folder name types itself in Daywalker beneath the card, ~40ms/char |
| 900ms | Card descends to rest: `translateY(0)`, `--e3` → `--e1`, 500ms `--ease-out` |
| 1400ms | Folder chip fades in at `--sage`. Done. |

Nothing else on screen moves during this. Under `prefers-reduced-motion`, run the crossfade and the folder name only, no lift, no typing animation (§7.4).

### 11.4 Correction

The folder chip is always editable — tap, rename, or move. Correction takes one tap and never asks the user to confirm. The agent is doing a chore on their behalf; being wrong about a chore is not an event.

### 11.5 What the agent must never surface

Derived from the PSD's own risk register. These are frontend constraints — even if the model returns them, do not render them.

| Forbidden | Source |
|---|---|
| Confidence scores, "I think this is about…" | §3.5 — nothing counts |
| Mood labels, sentiment badges, emotion tags | §3.5, and PSD §4.1's warning against drifting into positivity |
| Frank's restitution/chaos/quest as a visible score, type, or label | PSD risk 4 — exploratory, never presented as measurement |
| Streaks, completion rates, entry-count milestones | PSD risk 6 |
| Anything phrased as advice, reassurance, or reframing | PSD §4.1 — the beat-3 prompt design prohibits it |
| Summarising the user back to themselves | PSD §4.1 |

Folder names are **descriptive, not interpretive.** "Nights" and "The ward" are folder names. "Processing grief" and "Struggling" are diagnoses, and this product is not a diagnostic tool (PSD §1).

---

## 12. Archive

The cool room. Ground `--haze`, entry cards `--paper` at 60% opacity over it, folder chips `--sage`, dividers `--sage` at 40%.

Default view is **chronological, most recent first**, with folder chips as a filter row at the top rather than a folder grid. Reason: a folder grid is a filing cabinet and implies a task. A dated stream is a diary and implies nothing.

Empty state: *"Nothing kept yet. What you write on the home screen lands here."* — an invitation with a direction, not a mood (§16).

---

## 13. Safety layer

PSD §3.5: non-negotiable, minimal by design.

**Trigger.** Crisis-indicating content detected in the user's response.

**Behaviour.** Interrupt the arc. Full-screen card on `--paper`, no dismissal timer, no animation of any kind. Newsreader body at `--t-body`, `--ink`. Content: appropriate professional and crisis support for the user's region, presented as tappable numbers and links. One quiet secondary button to return.

**What the screen must not do.**
- Not counsel, advise, or ask a follow-up question.
- Not use `--moss` as an alarm colour, or red, or any colour not in the token set. This screen looks like the rest of the app. It is calm.
- Not animate. Not fade in. It is simply there.
- Not log, flag, or report — and the interface must contain a plain sentence saying so. PSD §3.5: the absence of reporting is a feature and should be said out loud.

**Their writing is preserved.** Returning from this screen returns them to their text, intact.

---

## 14. Privacy copy

PSD §3.6 is explicit that overclaiming here loses the moat. The interface must be precise about what leaves the device.

**Permitted:** *"Not stored. Not linked to you. Not reported to anyone."*
**Permitted:** *"Your writing is sent to an AI model to generate your question, and isn't kept afterwards."*
**Forbidden:** "Never leaves your phone." "Fully on-device." "100% private." "Encrypted end to end" — unless it is.

Where this copy lives: one line on the home screen footer, and expandable in full from the archive. Not a modal, not an onboarding step, not a badge.

---

## 15. States

| State | Treatment |
|---|---|
| First open, no entries | Home renders normally. Served text present. Archive lip reads "Nothing kept yet." |
| Composer empty | Keep button absent, not disabled. |
| Model call slow | §11.2 latency budget. Stream where possible (PSD §4.1). |
| Model call failed | Entry kept, "Unfiled", one quiet line: *"Couldn't sort that one. It's saved — file it whenever."* |
| Offline | Composer fully works. Entries save locally, sort when reachable. Say so once: *"Offline. Your writing saves here and sorts later."* |
| Voice unavailable | Voice control hidden entirely, not shown disabled. |
| Text too long for one call | Truncate for the model, never for the user. Their text is never edited. |

Errors state what happened and what to do. They do not apologise, and they never say "Oops" or "Something went wrong."

---

## 16. Voice and microcopy

The register: **plain, unhurried, adult, unsentimental.** This user hears wellbeing language all day and is inoculated against it.

**Never write:**
- "How are you feeling today?" — the question the whole product exists to replace
- "Well done!" / "Great job!" / "You showed up today" — congratulation (§3.5)
- "Take a moment for yourself" / "You deserve this" — wellbeing boilerplate
- "Let's…" — the facilitator voice; the product is not in the room with them
- Exclamation marks. Anywhere.
- Emoji. Anywhere.

**Do write:** sentence case, active voice, plain verbs. One job per string. The action keeps its name the whole way through — "Keep" produces "Kept" produces "24 kept."

**Prompts** (the Daywalker line above the composer) open onto the text just read, and never onto the user's interior state. *"What's here, after that?"* rather than *"How did that make you feel?"*

---

## 17. Accessibility floor

Not negotiable, and not a phase-two item.

- **Contrast:** all body text ≥4.5:1, large text and UI boundaries ≥3:1. §5.1 is the authority. Do not use `--moss`, `--sage`, `--clay` or `--stone` as body text on `--peach`.
- **Focus:** visible on every interactive element. `outline` is never set to `none` without a replacement of equal or greater visibility.
- **Targets:** 44px minimum, 8px minimum separation.
- **Semantics:** the composer is a `<textarea>` or a properly labelled contenteditable with `role="textbox"` and `aria-multiline`. The settling announces via `aria-live="polite"`: *"Kept in Nights."*
- **Motion:** §7.4.
- **Zoom:** layout survives 200% text zoom without horizontal scroll.
- **Screen reader order:** served text, then prompt, then composer. Matches visual order — do not reorder with CSS.
- **Voice is an addition, never a requirement.** Every path completes with the keyboard alone.

---

## 18. Open decisions

| # | Decision | Blocking | Owner |
|---|---|---|---|
| **D1** | **Home screen composition.** This spec puts the served text above the composer on one screen, satisfying both the brief and PSD criterion 2. Confirm, or choose: (a) receptive text as its own screen, archive as a tab, or (b) accept the journaling-app silhouette knowingly and change PSD §2. | Yes — §9 depends on it | Product |
| **D2** | **Daywalker commercial licence.** FFP covers the demo, not a paid product. Obtain written permission from Tokokoo, or select a substitute display face and re-run §6. | Before launch, not before demo | Product |
| **D3** | **Dated archive vs PSD §3.6/§3.7.** Persisted, dated, auto-organised entries imply storage and history, which the PSD frames as roadmap-only and its privacy copy as absent. Reconcile: local-only storage, or amend §3.6/§3.7. | Yes — §12 and §14 depend on it | Product |
| **D4** | **Palette additions.** `--paper`, `--ink`, `--ink-soft` are required for accessibility (§5.1). Confirm the extended set. | Yes | Design |
| **D5** | **Companion typefaces.** Newsreader + Hanken Grotesk proposed. Both free, both variable. Confirm or substitute. | Yes | Design |
| **D6** | **Beat 3 and 4 screens.** Not specified here. Do they take over the screen, or appear inline beneath the composer? Inline is faster to build and keeps the five-minute session on one surface. | Next iteration | Product + Design |
| **D7** | **Loading screen and onboarding.** Stubbed at §9.4. | Next iteration | Design |

---

## 19. Provenance

| Section | Derived from |
|---|---|
| §2, §3.1, §3.2, §3.5, §11.5, §13, §14 | PSD — §1, §2, §3.1, §3.5, §3.6, §4.1, risks 1, 2, 4, 6 |
| §5.1, §6.2, §6.3 | Direct inspection of the supplied font and its EULA; WCAG 2.1 contrast computation |
| §4, §6.1, §7, §9, §10, §11.3, §12, §16 | Design proposal — open to revision, no PSD dependency |
| §17 | WCAG 2.1 AA |
