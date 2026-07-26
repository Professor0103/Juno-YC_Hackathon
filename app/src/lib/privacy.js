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
