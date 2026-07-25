/**
 * Beat 3 — the question that comes back.
 *
 * SEAM. This is where the single Anthropic call goes (PSD §4.1: one call, no
 * chains, streamed). Everything below is a local stand-in so the screen can be
 * judged on a device without a key in the bundle. Replacing it should mean
 * changing the body of askDeepeningQuestion and nothing else.
 *
 * Whatever replaces it inherits these constraints, which are frontend rules
 * and hold even if the model returns something else (§11.5, PSD §4.1):
 *   - one question, asked once
 *   - no advice, reassurance, reframing, or encouragement
 *   - no summarising the user back to themselves
 *   - no mood labels, sentiment, scores, or confidence
 *   - never "how did that make you feel"
 */

/**
 * Close-reading questions about the scene rather than about the writer. They
 * ask for more narrative, which is the move the real prompt has to make too.
 * A fixed rota is obviously not adaptive; the model call is what makes it so.
 */
const STAND_IN_QUESTIONS = [
  'What happened just before that?',
  'Who else was there?',
  'What was the last thing anyone said out loud?',
  'Where were you standing when it started?',
  'What did you do next?',
  'What was still going on in the background?',
];

let cursor = 0;

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('aborted', 'AbortError'));
      },
      { once: true },
    );
  });

/**
 * @param {Array<{ who: string, text: string }>} transcript everything written this session
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<string>} one question
 */
export async function askDeepeningQuestion(transcript, { signal } = {}) {
  // Stands in for the round trip. The waiting state is part of the experience,
  // not a spinner, so it needs to be long enough to see.
  await wait(700 + Math.random() * 500, signal);

  const question = STAND_IN_QUESTIONS[cursor % STAND_IN_QUESTIONS.length];
  cursor += 1;
  return question;
}
