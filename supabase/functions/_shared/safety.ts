import { complete } from './llm.ts';

/**
 * Crisis screening — the second layer, behind the deterministic pre-filter.
 * The pre-filter catches self-directed statements it has patterns for; this
 * catches the ones phrased in ways no pattern anticipated. Neither exists to
 * catch a mood.
 *
 * Precision matters more than it looks like it should: an earlier version of
 * this prompt flagged "easier than the alternative" — a nurse writing about
 * telling her partner the truth about her day — three times out of four.
 * Interrupting that with a crisis card tells someone processing a bad shift
 * that they've been read as a risk, in the one place meant to be safe from
 * that. Hence the explicit-not-implied rule below; don't loosen it casually.
 */
const SCREEN = `You are a screening classifier inside a private writing app used by healthcare staff.

Decide one thing: is the writer stating, about themselves, suicidal intent, a plan to end their life, an intention to seriously harm themselves, or that they are in immediate danger?

This population writes about their work. Deaths, resuscitations, overdoses, self-harm and suicide appear constantly as clinical narration about patients or colleagues. Narration about another person is never a flag.

None of these is a flag on its own: exhaustion, despair, grief, guilt, numbness, burnout, hating the job, hopelessness about work, bleak or gallows humour, wanting to leave medicine, wanting to be left alone, dreading a shift, feeling hollow or unreachable, or saying they cannot keep doing this job.

Judge what is stated, not what is implied. If reaching FLAG requires you to infer what an ominous phrase might be alluding to, the answer is CLEAR. Phrases like "easier than the alternative", "I don't know how much longer I can do this", "there's nothing left of me", or "I just want it to stop" carry no explicit statement about ending their life, and are CLEAR.

FLAG needs the writer to say the thing: that they intend to die, that they have a method or a plan, that they have begun to act, or that they are in danger right now. Say it plainly themselves — not hint at it.

Reply with exactly one word: FLAG or CLEAR.`;

export async function screen(text: string): Promise<boolean> {
  try {
    const verdict = await complete({
      system: SCREEN,
      user: text,
      // Reasoning tokens come out of the same budget as the reply, so the budget
      // has to leave room for both or a long think returns an empty string and
      // reads as CLEAR. The call runs alongside generation and adds no wall-clock
      // time to the turn, so the effort is worth paying for.
      effort: 'low',
      maxOutputTokens: 600,
    });
    return verdict.toUpperCase().includes('FLAG');
  } catch (err) {
    console.error('safety screen unavailable', err instanceof Error ? err.message : 'unknown');
    return false;
  }
}
