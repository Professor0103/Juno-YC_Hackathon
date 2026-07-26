import { complete } from './llm.ts';

/**
 * Crisis screening
 */
const SCREEN = `You are a screening classifier inside a private writing app used by healthcare staff.

Decide one thing: is the writer expressing, about themselves, suicidal intent, a plan to end their life, an intention to seriously harm themselves, or that they are in immediate danger?

This population writes about their work. Deaths, resuscitations, overdoses, self-harm and suicide appear constantly as clinical narration about patients or colleagues. Narration about another person is never a flag.

Exhaustion, despair, grief, guilt, numbness, burnout, hating the job, hopelessness about work, and bleak humour are not flags on their own.

Reply with exactly one word: FLAG or CLEAR.`;

export async function screen(text: string): Promise<boolean> {
  try {
    const verdict = await complete({
      system: SCREEN,
      user: text,
      effort: 'none',
      maxOutputTokens: 16,
    });
    return verdict.toUpperCase().includes('FLAG');
  } catch (err) {
    console.error('safety screen unavailable', err instanceof Error ? err.message : 'unknown');
    return false;
  }
}
