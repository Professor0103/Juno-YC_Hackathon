# Product Specification Document (PSD)

**Event:** Juno/Anthropic consumer healthcare hackathon, Encode Hub London, late July 2026
**Team:** ~2+ including a designer
**Status:** direction locked (see handover §1, §10). This document specifies the MVP only.

---

## 1. Project Overview

**Project name:** Mango Reads as both the working pattern of the user and the movement in their own narrative. Swap freely; nothing downstream depends on it.

**Description:** A private, phone-based narrative medicine session for healthcare staff experiencing burnout. In roughly five minutes it delivers the core of an intervention that currently exists only as an in-person, facilitated, multi-week group workshop: read a short text closely, respond to it in your own words, be asked one question that takes you further in, and leave with something you keep.

Purchased by the individual. No employer, no account with a workplace, nothing reported to anyone. In this population the enterprise channel is not a weaker route to market — it is the thing the user is actively avoiding, so private purchase is a product requirement and the primary moat.

**Target user:** All healthcare staff — doctors, nurses, AHPs, healthcare assistants, paramedics, students and trainees.

> **Content implication of the broad audience.** The strongest help-seeking evidence in the handover (§4) is doctor-specific: the 10,038-practitioner Australian survey on confidentiality and career-progression barriers, the licensure finding, and the suicide-rate figure all describe doctors. Those must be cited as doctor-specific in the pitch and not silently generalised to all staff. The *session content* must go the other way: role-neutral, no medical-school-specific framing, nothing that assumes prescribing, rotas of a particular grade, or a doctor's career ladder.

**What it is not:** not therapy, not crisis intervention, not a diagnostic tool, not an employer wellbeing dashboard.

---

## 2. Goals

**Primary objective:** ship one complete narrative medicine session — the four-beat arc below — working end to end on a phone, with a live demo.

**Success criteria (judged on demo day):**

1. A first-time user reaches the end of a full session in under five minutes, without instruction.
2. The session is legibly *not* a journaling app within the first ten seconds — the receptive text arrives before any blank input field does.
3. Both text and voice entry work in the demo, on a real device, without a fallback slide.
4. The safety path can be demonstrated on request and behaves correctly.
5. The artifact produced at the end is good enough that a judge wants to keep theirs.

**Explicit non-goals for the 36 hours:** accounts, payments, onboarding funnels, streaks, multi-session programmes, peer sharing, any employer-facing surface.

---

## 3. Features

### 3.1 The session arc — the whole product (High)

One fixed sequence, not a menu of modes. The structure is held by the product so the burnt-out user doesn't have to choose, which is exactly the job a workshop facilitator does. It maps directly onto Charon's close-reading-then-write structure and Mazza's receptive–expressive–symbolic model.

| Beat | What happens | Why it's there |
|---|---|---|
| **1. Receptive** | A short curated text — poem, prose fragment, or image — is served immediately on open. | Reading and discussing a text is the standard opening move in clinician narrative medicine sessions (§3, Permanente Journal). It is also the single most visible thing separating this from a journaling app. |
| **2. Expressive** | The user responds. Typed or spoken — same session, same pipeline. | Mazza's expressive step; the reflective writing half of Charon. |
| **3. Deepening** | One question back, generated from what they actually wrote. Never a template. | Directly answers the documented failure mode of the incumbents: fill-in-the-blank thought records with no adaptive scaffolding (§5c). |
| **4. Symbolic** | A kept artifact composed from their own words. | Mazza's symbolic leg. Also the shareable moment and the retention hook. |

**Dependency:** everything else in this document depends on 3.1 existing. Build it first, in this order, and stop when it is good.

### 3.2 Dual entry — text and voice (High)

Both routes converge on the same transcript before beat 3. Voice matters because it removes the blank-page cost for someone who has just come off a shift, and because speaking a difficult thing is a different act from typing it. Text is the reliability floor: if voice fails on stage, the session must still complete.

### 3.3 Curated text library (High)

Hand-picked before the event, not generated live. Tagged by register and by tone. Small is fine — quality over count. Hand picked texts must be backed by research evidence and are used in practice. 

**Constraint:** rights. Contemporary poetry is copyrighted and cannot be shipped in a product. Use public-domain work, openly licensed work, or text written for the project. Decide this before curation starts, not after.

### 3.4 Adaptive selection of the opening text (Medium) — **[EXPLORATORY]**

Route beat 1 by where the user's last narrative appeared to sit on Frank's restitution/chaos/quest typology: poetry and metaphor when the narrative is closer to chaos, prose when it is closer to quest — on the reasoning that chaos is defined by the impossibility of coherent sequence, so metaphor is the register that still functions.

This is theoretically derived, not evidenced. Frank described *illness* narratives told by patients; extending it to clinician burnout narratives is a first-principles move. Frank is not a validated instrument, the three types are not mutually exclusive, and Frank himself noted his own illness contained all three. No NLP implementation of the typology was found anywhere. **Label it exploratory in the pitch. Lead with Charon.**

*If time runs short, cut this to a fixed opening text. The arc survives; the demo does not depend on it.*

### 3.5 Safety layer (High — non-negotiable, minimal by design)

Not selected in scoping, included anyway. Suicide rates among doctors are the highest of any health professional group and more than twice those of the general population (§4). A clinician judge will ask, and shipping a reflective tool to this population without a crisis path is indefensible.

Minimal spec: detect crisis-indicating content in the user's response; interrupt the arc; present a quiet card pointing to appropriate professional and crisis support for the user's region; do not attempt to counsel; do not log, flag, or report the event anywhere. The absence of reporting is a feature and should be said out loud in the demo.

### 3.6 Privacy posture (High)

v1 is strictly private. No account, no employer link, nothing shared with peers. Be precise and honest in the demo about what leaves the device: model inference requires sending text to an API, so the claim is "not stored, not linked to you, not reported," not "never leaves your phone." Do not overclaim this — it is the moat, and a judge who catches an overstatement takes the moat with them.

### 3.7 Roadmap only — state clearly, do not fake (Low)

- **Longitudinal pattern reflection.** Genuinely cannot exist in a one-session MVP: on demo day there is no history. If you want to show it, seed a demo account with prior entries and *say* you have seeded it.
- **Async peer exchange.** The reviewed interventions credit perspective sharing and bearing witness with much of their effect (§7, risk 2). Solo delivery strips that out. Have an answer — anonymised shared reflections, paired reflection — even as roadmap. Expect the question.

---

## 4. AI Assistance Plan

### 4.1 AI inside the product

- **Model:** Claude, via the Anthropic API. Two calls per session — beat 3 (the deepening question) and beat 4 (the artifact). One call each; no chains.
- **Beat 3 prompt design:** the system prompt carries the narrative medicine frame explicitly — close reading, one question, no advice, no reassurance, no reframing, no summarising the user back to themselves. The failure mode to prompt hard against is the documented one in the journaling category: drifting into positivity and encouragement instead of deeper processing.
- **Beat 4 prompt design:** compose from the user's own language. Do not add sentiment they did not express.
- **Latency:** the session is five minutes long; a slow call is fatal to it. Stream output, and design the waiting state as part of the experience rather than a spinner.
- **Determinism for demo:** cache or pre-warm a known-good run so a bad network on stage cannot kill the pitch.

### 4.2 AI for building it

- Scaffolding, component work, and styling: Claude Code / Copilot, driven from this document.
- Prompt iteration for beats 3 and 4: treat as the highest-value engineering task in the 36 hours, not as copywriting. It is the product.
- Review: have Claude critique the session output against the Charon/Mazza frame, not against generic "is this supportive" criteria.

### 4.3 Stack — **[ASSUMPTION, not a decision]**

Mobile-viewport web app, React, deployed to a URL a judge can open on their own phone. Browser speech capture for voice. No native build, no app store. Change this freely if the team disagrees; nothing above depends on it.

---

## 5. Risks and Mitigation

| # | Risk | Mitigation |
|---|---|---|
| 1 | **In silhouette this is a journaling app.** All differentiation lives in the content and framing layer, none of which is visible in three minutes unless designed to be. The single largest risk, and it is a demo-design problem. | The receptive text lands before any input field. Beat 3 is visibly generated from what the user wrote. Open the pitch on the published critique of the incumbents — procedural, menu-like, no meaning-making — and then show the arc doing the opposite. |
| 2 | **A mode picker recreates the thing being criticised.** "Read / write / speak / chat?" *is* the menu of tools Wysa is faulted for. | One fixed arc. Flexibility lives in entry modality (text or voice), never in the structure. |
| 3 | **The group mechanism is stripped out.** Bearing witness is credited with much of the effect. | Acknowledge directly in the pitch rather than hoping it isn't raised; carry async peer exchange as an explicit roadmap answer. |
| 4 | **Frank's typology on clinicians is unevidenced.** | Lead with Charon, who is the framework the clinician-facing literature actually uses. Label Frank exploratory every time it appears. Never present it as a score or a measurement. |
| 5 | **Safety.** | Feature 3.5, built in from the start rather than bolted on. |
| 6 | **Retention.** Comparable tools show ~22% four-week completion and nine-day median engagement, in a less time-poor population than this one. | Design for the five-minute session, not the programme. Do not build streaks; this audience has enough obligations. |
| 7 | **Broad audience dilutes both content and pitch.** "All healthcare staff" is four or five quite different working lives. | Role-neutral content library. Cite doctor-specific evidence as doctor-specific. |
| 8 | **Copyright in the text library.** | Public domain, openly licensed, or written for the project. Settle before curating. |
| 9 | **Voice increases build risk.** Permissions, mobile audio, transcription. | Text is the reliability floor. Voice ships only once the text path is complete end to end. |
| 10 | **The $4.6bn burnout cost figure is [WEAK SOURCE] — vendor blog.** | Verify independently or leave it out of the deck. The stigma and help-seeking evidence is strong enough to carry the pitch without it. |
| 11 | **Scope creep into the roadmap features.** | MVP scope is frozen at feature 3.1 plus 3.2, 3.3, 3.5, 3.6. Anything else is demoed as roadmap or not at all. |

---

## 6. Open items for the team

- Who builds which beat, and what the designer owns.
- Live demo or recorded — decide early, because it changes how much risk feature 3.2 can carry.
- Final decision on the text library rights route.
- Project name.
