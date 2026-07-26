/**
 * Every user-facing privacy string in the product, in one module (PSD 3.7).
 *
 * One rule governs edits here, and it is the reason the strings are not written
 * inline where they are shown: the honest claim is that entries are not stored
 * under a name, not linked to an employer and not reported to anyone. It is NOT
 * that the writing stays on the device. Generating each turn sends the session so
 * far to an API, so any phrasing along the lines of "it never leaves
 * your phone", "processed locally", "fully offline" or "we never see it" is
 * false. A judge who catches an overstatement takes the moat with them, and the
 * moat is the whole pitch.
 *
 * Nothing here promises deletion by the model provider either. We do not control
 * that and cannot stand behind it on stage.
 */
export const privacy = {
  /** The claim itself. Safe to show anywhere. */
  claim: 'Not stored under a name. Not linked to your employer. Not reported to anyone.',

  /** Shown where the user is about to send writing to be worked on. */
  inference:
    'To answer you, the session so far is sent to a language model and comes back. That is the one place it travels, and it travels with nothing attached that identifies you.',

  /** Shown beside the keep action at the end of the session. */
  kept: 'Kept against an anonymous session on this device. No name, no email, no employer.',

  /** Shown on the safety card, where the absence of reporting is the point. */
  unreported:
    'Nothing about this has been recorded, flagged or sent to anyone. There is no note on your account, because there is no account.',
};

/**
 * Consent-gate copy (onboarding, before any session exists). Distinct from
 * `privacy` above only in when it's shown — the same no-overstatement rule
 * governs both, so it lives in this module rather than inline in JSX.
 */
export const consentCopy = {
  intro:
    "Your response is sent to Claude, Anthropic's AI, to generate your next question and the piece you keep at the end.",

  policyAgreement: "I agree to Mango's Privacy Policy and Terms of Use.",
  policyLinkLabel: 'Read the full policy',

  notStored:
    "I understand my response isn't stored beyond this session, linked to me or an employer, or reported anywhere — and that a safety concern in what I write is never logged either.",

  declineNote:
    "Mango needs to send your response to generate your session — without this we can't continue.",

  sheet: {
    title: 'Privacy & terms',
    sections: [
      {
        heading: "What's sent, and why",
        body: 'Text or voice you enter during a session is sent to Claude via the Anthropic API twice: once to generate the question that takes you further in, and once to compose the piece you keep at the end.',
      },
      {
        heading: "What isn't done with it",
        body: "Nothing here creates an account or an employer-linked record. Your response isn't stored once the session ends, isn't shared with anyone, and isn't used to train anything.",
      },
      {
        heading: 'The safety layer',
        body: 'If a response signals a crisis, the session pauses to show you regional support contacts. That moment is never logged, flagged, or reported — the absence of a record is deliberate.',
      },
      {
        heading: 'Name, age, and gender',
        body: "Anything you entered on the previous screens lives only in this session's memory. None of it is saved when the app closes, whether or not you continue past this screen.",
      },
      {
        heading: "If you don't continue",
        body: "Mango can't run a session without sending your response somewhere to generate the next step, so declining here means the session can't start today.",
      },
    ],
  },
};
