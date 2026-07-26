# Product Specification Document (PSD) — FINAL

**Project:** *Shift* (provisional name)
**Event:** Juno/Anthropic consumer healthcare hackathon, Encode Hub London, late July 2026
**Team:** ~2+ including a designer · **Build window:** ~36 hours
**Supersedes:** `02-product-specification-document.md`
**Template:** `01-product-specification-document.md` — five sections followed exactly; screen walkthrough appended as Appendix A.

---

## 1. Project Overview

**Description.** A private narrative medicine app for healthcare staff experiencing burnout. It has two modes with one relationship between them:

- **Chart** — fast, unstructured capture. Text or voice. No prompt, no arc, no AI in the way. For the ten minutes after a shift when something needs to go somewhere.
- **Reflection** — a five-minute narrative medicine session: a short curated text, your written or spoken response to it, one question that takes you further in, and an artifact composed from your own words that you keep.

**The relationship is the product.** A Chart entry can be *promoted* into a Reflection later — the app offers a receptive text matched to what you already wrote. Capture, then close reading. That sequence is the method; the two modes are its two halves, not two features sharing a toggle.

**Framing of the Chart mode — [VERIFY BEFORE PITCH].** "Chart" is not a journaling-category borrowing; it is Charon's *parallel chart* — the second chart a clinician keeps for everything that cannot go in the medical record. This lineage should be confirmed against a primary source before it is asserted to a clinician judge. *Copy line it yields: you chart for everyone else all day; this one's yours.* Alternative names if "Chart" tests as feeling like work: **Log**, **Note**, **Off-shift**.

**Purchased by the individual.** No employer, no workplace account, nothing reported to anyone. In this population the enterprise channel is not a weaker route to market — it is the thing the user is actively avoiding, so private purchase is a product requirement and the primary moat.

**Target user.** All healthcare staff — doctors, nurses, AHPs, healthcare assistants, paramedics, students and trainees.

> **Content implication of the broad audience.** The strongest help-seeking evidence in the handover (§4) is doctor-specific: the 10,038-practitioner Australian survey on confidentiality and career-progression barriers, the licensure finding, and the suicide-rate figure all describe doctors. Cite them as doctor-specific; do not silently generalise. The *session content* must go the other way — role-neutral, no assumptions about grade, prescribing, or a doctor's career ladder.

**Theoretical stack, in order of weight.**

| Layer | Role | Status |
|---|---|---|
| **Charon — narrative medicine** | The clinical frame and the evidence base. Close reading, then reflective writing. Also the source of the parallel chart. | Primary anchor. Lead with this. |
| **Mazza — RES model** | The *session structure*: receptive → expressive → symbolic. Tells you a session needs a stimulus, a response, and a kept artifact. | Structural scaffold. |
| **Frank — restitution/chaos/quest** | Classifies where a narrative sits; used to route which text is served and to show movement over time. | **[EXPLORATORY]** — see Risk 5. |

**Poetry's actual place.** Mazza's model is a session *shape*, not a genre requirement. Poetry is the most time-efficient receptive stimulus for someone five minutes off a shift — it compresses a lot into little reading. But prose fragments and images work identically in the arc. If asked "is this a poetry app": no. It is narrative medicine, delivered on a phone, structured using poetry therapy's session model.

**What it is not:** not therapy, not crisis intervention, not diagnostic, not an employer wellbeing dashboard, not a mood tracker.

---

## 2. Goals

**Primary objective.** Ship the Reflection arc working end to end on a phone, with Chart capture real alongside it, and the surrounding surfaces seeded well enough that a judge can explore the full product vision.

**Success criteria (demo day).**

1. A first-time user completes a full Reflection in under five minutes, unaided.
2. It is legibly *not* a journaling app within ten seconds — the receptive text arrives before any blank input field does.
3. Text and voice both work on a real device, no fallback slide.
4. Chart → Reflection promotion is demonstrated live. This is the moment the two modes stop looking like a menu.
5. The safety path can be demonstrated on request and behaves correctly.
6. Every seeded surface is *labelled* as seeded when a judge reaches it.
7. The artifact is good enough that a judge keeps theirs.

**Non-goals.** Accounts, payments, onboarding funnels, streaks, real longitudinal persistence, peer sharing, any employer-facing surface.

---

## 3. Features

Priority: **High** = the demo fails without it. **Medium** = seeded, explorable, labelled. **Low** = roadmap, stated verbally.

### 3.1 The Reflection arc (High) — the whole product

One fixed sequence. No mode picker inside it. The structure is held by the app so a burnt-out user doesn't have to choose — which is the job a workshop facilitator does, and this product replaces the facilitator.

| Beat | What happens | Why |
|---|---|---|
| **1. Receptive** | A short curated text — poem, prose fragment, or image — served on open. | Reading and discussing a text is the standard opening move in clinician narrative medicine sessions (§3). Also the single most visible thing separating this from journaling. |
| **2. Expressive** | User responds, typed or spoken. | Mazza's expressive step; Charon's reflective writing. |
| **3. Deepening** | One question back, generated from what they actually wrote. Never a template. | Answers the documented incumbent failure: fill-in-the-blank records with no adaptive scaffolding (§5c). |
| **4. Symbolic** | A kept artifact composed from the user's own words. | Mazza's symbolic leg. The screenshot moment and the retention hook. |

**Build this first, in this order, and stop when it is good.** Everything below depends on it.

### 3.2 Chart capture (High)

Freeform text or voice. No receptive text, no generated question, no AI intervention at the point of writing. Saves with date and an optional single-word tag. Deliberately unglamorous — its value is that it takes fifteen seconds.

### 3.3 Chart → Reflection promotion (High)

From any Chart entry: *reflect on this*. The app selects a receptive text responsive to what was written, then runs the standard arc with the Chart entry available as context. This is the feature that makes two modes into one method. Demo it explicitly.

### 3.4 Dual entry — text and voice (High)

Both routes converge on the same transcript. Voice removes the blank-page cost post-shift, and speaking a hard thing is a different act from typing it. Text is the reliability floor: if voice fails on stage, everything still completes.

### 3.5 Curated text library (High)

Hand-picked before the event. Tagged by register and tone. Small is fine.

**Rights constraint:** contemporary poetry is copyrighted and cannot ship in a product. Public domain, openly licensed, or written for the project. Settle this before curation starts.

**No browse/pick-your-own-text surface.** Letting the user choose the opening text recreates the menu-of-tools pattern the product is positioned against. The app chooses; that is the point.

### 3.6 Safety layer (High — non-negotiable)

Suicide rates among doctors are the highest of any health professional group and more than twice those of the general population (§4). A clinician judge will ask.

Minimal spec: detect crisis-indicating content in Chart or Reflection input; interrupt; present a quiet card pointing to appropriate professional and regional crisis support; do not counsel; **do not log, flag, or report the event anywhere**. The absence of reporting is a feature — say it out loud in the demo.

### 3.7 Privacy posture (High)

No account, no employer link, nothing shared with anyone automatically. Be precise: model inference sends text to an API, so the honest claim is *not stored, not linked to you, not reported* — never "it never leaves your phone." Do not overclaim; a judge who catches an overstatement takes the moat with them.

The one route data leaves is user-initiated export (3.9), which the user triggers and directs themselves.

### 3.8 Calendar and entry navigation (Medium — seeded)

Month view; days marked by entry type (Chart / Reflection). Tap to open a past entry. Seeded with mocked history, styled to feel real, **labelled as seeded**.

**No streaks, no completion rings, no gamification.** This audience has enough obligations and enough things measuring them. A missed day must look like nothing at all.

### 3.9 Clinician export (Medium — export logic real, history mocked)

User-triggered: *prepare a summary*. Compiles selected entries into a plain readable document for the user's **own GP or therapist** — patient-directed to highlight Ideas, Concerns and Expectations (ICE framework). Not occupational health, not employer-facing; building anything that reads that way would undermine §1 and §3.7 given the stigma evidence the product is designed around.

- **The export mechanism can be genuinely real for the demo** — run it against mocked history, produce an actual document live. Strong demo beat precisely because it isn't faked.
- **What's mocked is only the history feeding it.**
- UI verb is **export** or **prepare**, never *submit* or *send to your team*. A line of copy near the button stating nothing goes anywhere without their action makes the moat visible rather than claimed.

### 3.10 Insights / AI analytics (Medium — seeded) — **[EXPLORATORY]**

Patterns across the mocked history: recurring themes in the user's own words, and movement across Frank's typology over time.

**Constraints, non-negotiable in the UI copy itself:** no score, no index, no percentage, no diagnosis, nothing that reads as a psychometric result. Frank is not a validated instrument, the three types are not mutually exclusive, and Frank noted his own illness contained all three. No NLP implementation of the typology was found anywhere. Label it exploratory *on the screen*, not just in your heads.

### 3.11 About the approach (Medium — static)

Charon, Mazza's RES, Frank flagged exploratory, and the evidence citations from the handover. Nearly free to build — it's largely text that already exists — and it converts "trust us" into something a clinician judge can verify. **Best value-per-minute page in the build.**

### 3.12 Contextual help (Medium — static)

A small **i** in the corner of session screens opening a short sheet: why this screen works this way. Philosophy delivered at the moment of use rather than buried in settings. Links through to 3.11.

### 3.13 Settings (Medium)

Privacy & data · voice & input · export · support & crisis resources · notifications · delete everything. See Appendix A, screens 11a–11f.

### 3.14 Roadmap only — state, don't fake (Low)

- **Async peer exchange.** The reviewed interventions credit perspective sharing and bearing witness with much of their effect (§7). Solo delivery strips it out. Have the answer ready — anonymised shared reflections, paired reflection — even as a single static screen.
- **Real persistence.** On-device storage or lightweight accounts is a post-hackathon decision, not a 36-hour one.
- **Pricing.** One static screen only if the judging criteria reward business viability — check the brief. No payment logic.

---

## 4. AI Assistance Plan

### 4.1 AI inside the product

- **Model:** Claude via the Anthropic API. Two calls per Reflection — beat 3 and beat 4. One call each; no chains. Chart mode makes **zero** calls at the point of writing, deliberately.
- **Beat 3 prompt:** system prompt carries the narrative medicine frame explicitly — close reading, one question, no advice, no reassurance, no reframing, no summarising the user back to themselves. The failure mode to prompt hard against is the documented one in the journaling category: drifting to positivity and encouragement instead of deeper processing.
- **Beat 4 prompt:** compose from the user's own language. Add no sentiment they did not express.
- **Text selection (3.3, 3.10):** classification of narrative register to route the receptive text. Exploratory; keep the mapping legible and overridable.
- **Latency:** a five-minute session cannot absorb a slow call. Stream output; design the waiting state as part of the experience, not a spinner.
- **Demo determinism:** cache or pre-warm a known-good run so a bad network cannot kill the pitch.

### 4.2 AI for building it

- Scaffolding, components, styling: Claude Code / Copilot, driven from this document.
- Prompt iteration for beats 3 and 4 is the highest-value engineering task in the 36 hours. It is the product, not copywriting.
- Review: have Claude critique session output against the Charon/Mazza frame — not against generic "is this supportive."

### 4.3 Stack — **[ASSUMPTION, not a decision]**

Mobile-viewport web app, React, deployed to a URL a judge opens on their own phone. Browser speech capture for voice. No native build, no app store. Change freely; nothing above depends on it.

---

## 5. Risks and Mitigation

| # | Risk | Mitigation |
|---|---|---|
| 1 | **In silhouette this is a journaling app — and adding Chart mode makes that literal.** The largest risk in the project, now amplified by design. | Chart is framed as Charon's parallel chart, not as journaling. The Reflection arc is the default landing state, not Chart. Promotion (3.3) is demoed early so the two modes are visibly one method. Open the pitch on the published critique of incumbents — procedural, menu-like, no meaning-making — then show the arc doing the opposite. |
| 2 | **Two modes plus a nav bar = the menu of tools Wysa is faulted for.** | Toggle is binary, not a list. No mode picker *inside* Reflection. No browse-the-library surface. Flexibility lives in entry modality only, never in structure. |
| 3 | **Seeded surfaces read as vapourware if unlabelled.** | Every mocked screen says so on the screen. Judges reward honesty about scope far more than they reward a screenshot that turns out to be static. |
| 4 | **The group mechanism is stripped out.** Bearing witness carries much of the documented effect. | Raise it in the pitch before it's raised at you; carry 3.14 peer exchange as the explicit roadmap answer. |
| 5 | **Frank on clinicians is unevidenced** — a first-principles extension from *illness* narratives told by patients. | Lead with Charon. Label Frank exploratory in the pitch *and in the UI*. Never present it as a score. |
| 6 | **The Insights page could read as clinical measurement.** | No numbers, no scores, no diagnosis language. Themes in the user's own words, movement described qualitatively. |
| 7 | **Safety.** Highest suicide rate of any health professional group. | Feature 3.6, built in from the start, demonstrable on request. |
| 8 | **Retention.** Comparable tools show ~22% four-week completion, nine-day median engagement — in a less time-poor population than this one. | Design for the five-minute session, not the programme. Chart exists because fifteen seconds is sometimes all there is. No streaks. |
| 9 | **Notifications could actively harm trust** with a population already saturated in pagers, bleeps and rota alerts. | Default off. Opt-in only, low frequency, never guilt-framed. |
| 10 | **Broad audience dilutes content and pitch.** | Role-neutral library. Doctor-specific evidence cited as doctor-specific. |
| 11 | **Copyright in the text library.** | Public domain, openly licensed, or written for the project. Settle before curating. |
| 12 | **Voice increases build risk** — permissions, mobile audio, transcription. | Text is the reliability floor. Voice ships only once text works end to end. |
| 13 | **The $4.6bn burnout cost figure is [WEAK SOURCE]** — vendor blog. | Verify independently or leave it out. The stigma evidence carries the pitch without it. |
| 14 | **Parallel chart attribution unverified.** | **[VERIFY BEFORE PITCH]** against a primary Charon source. |
| 15 | **Scope creep.** | Frozen at 3.1–3.7 built real; 3.8–3.13 seeded; 3.14 verbal. Nothing else. |

---
