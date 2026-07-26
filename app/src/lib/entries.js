/**
 * Kept entries — what the calendar marks and what an entry card opens onto.
 *
 * SEAM. There is no store behind this yet. Everything here lives in memory for
 * the length of a session, which is why the seeded entry below exists: without
 * it the calendar has nothing to show and the card has nothing to open. When a
 * store arrives it should hand back this same shape and the seed can go.
 */

/** @typedef {{ id: string, day: string, at: Date, mode: 'journal' | 'reflection',
 *              title?: string, body: string[], mood?: string, themes?: string[] }} Entry */

let nextId = 1;
const id = () => `entry-${nextId++}`;

/** Local, not ISO — see the note on dayKey in App.jsx. */
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * One worked example, dated today so it lands on the month the calendar opens
 * on. Its shape is the full one — title, mood, themes — because it is what the
 * entry card is built against; entries written in the session carry only what
 * the screen actually collects.
 */
export function seedEntries(now = new Date()) {
  return [
    {
      id: id(),
      day: dayKey(now),
      at: now,
      mode: 'journal',
      title: 'A quiet win',
      body: [
        'Today felt slow in the best way.\nI finally finished the project I have been putting off for weeks. There was not a huge payoff, just a sense of relief and a little pride.',
        'Took a walk in the evening. The light was beautiful. I am trying to remember that progress does not always have to be loud.',
      ],
      mood: 'Calm',
      themes: ['Personal Growth', 'Purpose', 'Mindfulness'],
    },
  ];
}

/** @returns {Entry} */
export function makeEntry({ text, mode, at = new Date() }) {
  return {
    id: id(),
    day: dayKey(at),
    at,
    mode,
    body: [text],
  };
}

/**
 * Entries for one day in one mode, oldest first — the calendar shows a mark
 * per day, and opening that day opens what is behind the mark.
 */
export function entriesOn(entries, day, mode) {
  return entries.filter((entry) => entry.day === day && entry.mode === mode);
}

/** The set of days carrying at least one entry in this mode. */
export function daysWithEntries(entries, mode) {
  const days = new Set();
  for (const entry of entries) {
    if (entry.mode === mode) days.add(entry.day);
  }
  return days;
}

export const MODE_LABEL = {
  journal: 'Journal Entry',
  reflection: 'Reflection',
};
