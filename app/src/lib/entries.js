/**
 * Kept entries — what the calendar marks and what an entry card opens onto.
 *
 * SEAM. There is no store behind this yet. Everything here lives in memory for
 * the length of a session, which is why the seeded corpus below exists: without
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
 * A seeded entry's clock time, `daysAgo` days back from `now`. Local rather
 * than UTC because dayKey is, and a 03:12 night entry has to stay on the night
 * it belongs to. Today's times are clamped: an entry written for 09:30 must not
 * sit in the future when the demo is run at nine.
 */
const seedTime = (now, daysAgo, hour, minute) => {
  const when = new Date(now);
  when.setDate(when.getDate() - daysAgo);
  when.setHours(hour, minute, 0, 0);
  return when > now ? now : when;
};

/**
 * One voice, six months of writing, laid across the fortnight behind today so
 * the calendar opens onto something with a shape to it. Read in order it runs
 * from chaos to quiet: the bleep and the carpark at one end, names and a garden
 * at the other. Reflections land on or after the entry they grew out of.
 *
 * Nothing here identifies a patient — no names, no bays, no diagnoses, no dates
 * of admission. That is deliberate, and worth pointing at.
 *
 * Reflections carry the full four-beat shape the mode produces: the text that
 * was served, the first response, the question back, the second response, and
 * the line that was kept.
 */
const SEED = [
  {
    daysAgo: 13,
    hour: 3,
    minute: 12,
    mode: 'journal',
    title: 'The bleep during the arrest',
    body: [
      'Third night. The bleep went off during the arrest and I answered it. I answered the bleep. Everyone looked at me. I don’t know why I did that.',
    ],
    mood: 'Rattled',
    themes: ['Night Shifts', 'Overwhelm', 'Self-Doubt'],
  },
  {
    daysAgo: 13,
    hour: 8,
    minute: 40,
    mode: 'journal',
    title: 'Yesterday’s list',
    body: [
      'Slept four hours. Woke up doing the list in my head. Not today’s list. Yesterday’s. Nobody on it is mine anymore.',
    ],
    mood: 'Depleted',
    themes: ['Sleep', 'Rumination', 'Carrying Work Home'],
  },
  {
    daysAgo: 12,
    hour: 4,
    minute: 5,
    mode: 'journal',
    title: 'Forty minutes in the carpark',
    body: [
      'Sat in the carpark for forty minutes before going in. Not crying. Just sat. Engine off. Then went in and was completely normal for thirteen hours.',
    ],
    mood: 'Numb',
    themes: ['Night Shifts', 'Dread', 'Masking'],
  },
  {
    daysAgo: 12,
    hour: 22,
    minute: 50,
    mode: 'journal',
    title: 'Fine, fine, fine',
    body: [
      'Fine. Fine fine fine. Ate a sandwich in the stairwell and that was the best part of the day and I’m aware of how that sounds.',
    ],
    mood: 'Flat',
    themes: ['Coping', 'Small Comforts', 'Isolation'],
  },
  {
    daysAgo: 11,
    hour: 9,
    minute: 15,
    mode: 'reflection',
    title: 'The faces I can’t remember',
    body: [
      'The text:\n“You clocked eight hours over. On the drive home you noticed you could not remember the faces of the last three people you had spoken to.”',
      'I used to remember everyone. Now I remember the tasks. I don’t know when that changed or whether I should be worried that it did.',
      'The question back:\n“You said you don’t know when it changed. Not to prove it — just to guess: was there a shift, or a season, or was it slower than that?”',
      'Slower. Maybe a year. I didn’t notice because I kept getting better at the job while it was happening.',
      'What I kept:\n“I kept getting good at my job while something else went quiet.”',
    ],
    mood: 'Unsettled',
    themes: ['Depersonalisation', 'Competence', 'Slow Change'],
  },
  {
    daysAgo: 11,
    hour: 23,
    minute: 30,
    mode: 'journal',
    title: 'Nine minutes',
    body: [
      'Handover took nine minutes. Nine minutes to hand over twenty-two people. I said the words and the words were correct.',
    ],
    mood: 'Detached',
    themes: ['Handover', 'Going Through The Motions', 'Volume'],
  },
  {
    daysAgo: 10,
    hour: 3,
    minute: 55,
    mode: 'journal',
    title: 'The man in the side room',
    body: [
      'I keep wanting to write his name here and I keep not doing it. So: the man in the side room. That’s as much as I’ll put down. He was kind to me on the worst night and I never said anything back.',
    ],
    mood: 'Tender',
    themes: ['Night Shifts', 'Kindness Received', 'Things Unsaid'],
  },
  {
    daysAgo: 10,
    hour: 7,
    minute: 20,
    mode: 'journal',
    title: 'Push through to April',
    body: ['Can push through to April. April is doable. After the rota changes it’ll be fine.'],
    mood: 'Determined',
    themes: ['Endurance', 'Bargaining', 'The Rota'],
  },
  {
    daysAgo: 9,
    hour: 21,
    minute: 10,
    mode: 'journal',
    title: 'Perfect system',
    body: [
      'Someone asked how I was in the corridor and I said good thanks and kept walking and they kept walking and neither of us broke stride. Perfect system.',
    ],
    mood: 'Guarded',
    themes: ['Masking', 'Colleagues', 'Avoidance'],
  },
  {
    daysAgo: 9,
    hour: 22,
    minute: 40,
    mode: 'reflection',
    title: 'If the corridor had been longer',
    body: [
      'The text:\n“There is a room\nyou pass four times a shift\nand once, going by,\nsomeone in it\nasked how you were\nand meant it.\nYou have not stopped\nwalking since.”',
      'That’s the side room. I don’t know why that’s the thing that stayed. Plenty of worse things happened that month and this is the one I keep coming back to.',
      'The question back:\n“You’ve written that you never said anything back. What would you have said, if the corridor had been longer?”',
      'Probably nothing clever. Just that I noticed. That I noticed he was being kind to me when he had every reason not to be, and that it landed, even though I kept walking.',
      'What I kept:\n“I noticed. It landed. I kept walking, and it landed anyway.”',
    ],
    mood: 'Moved',
    themes: ['Kindness Received', 'Things Unsaid', 'Being Seen'],
  },
  {
    daysAgo: 8,
    hour: 4,
    minute: 44,
    mode: 'journal',
    title: 'There is no bleep in the supermarket',
    body: [
      'The bleep. Always the bleep. I hear it in the car. I heard it in the supermarket. There is no bleep in the supermarket.',
    ],
    mood: 'Wired',
    themes: ['Night Shifts', 'Hypervigilance', 'Carrying Work Home'],
  },
  {
    daysAgo: 8,
    hour: 8,
    minute: 5,
    mode: 'journal',
    title: 'Managed',
    body: ['Managed. That’s the word for this week. Managed.'],
    mood: 'Blunted',
    themes: ['Coping', 'Endurance', 'Bare Minimum'],
  },
  {
    daysAgo: 7,
    hour: 22,
    minute: 15,
    mode: 'journal',
    title: 'April is not doable',
    body: [
      'Rota came out. April is not doable. April is worse. Sat with that for about ninety seconds and then made a cup of tea and did not sit with it again.',
    ],
    mood: 'Resigned',
    themes: ['The Rota', 'Avoidance', 'Disappointment'],
  },
  {
    daysAgo: 6,
    hour: 3,
    minute: 30,
    mode: 'journal',
    title: 'Didn’t know what to do with my hands',
    body: ['Quiet night. Genuinely quiet. Didn’t know what to do with my hands.'],
    mood: 'Restless',
    themes: ['Night Shifts', 'Stillness', 'Unfamiliar Quiet'],
  },
  {
    daysAgo: 6,
    hour: 9,
    minute: 50,
    mode: 'reflection',
    title: 'The bit after the bit',
    body: [
      'The text:\n“The plan was: get through this bit. Then the bit after it. There has been a bit after it for some time now.”',
      'Yes. That’s it exactly. It’s always been a case of getting to the next thing and the next thing keeps being followed by another one and I’ve stopped asking when it stops.',
      'The question back:\n“When did you last finish something and let it be finished, rather than moving straight to what came after?”',
      'I honestly can’t answer that. I don’t think I’ve let anything be finished. Even the good days I file as survived rather than done.',
      'What I kept:\n“Even the good days I file as survived, rather than done.”',
    ],
    mood: 'Weary',
    themes: ['Endurance', 'No Finish Line', 'Self-Recognition'],
  },
  {
    daysAgo: 6,
    hour: 21,
    minute: 0,
    mode: 'journal',
    title: 'Said no',
    body: ['Said no to a locum shift. Felt sick about it for an hour. Then didn’t.'],
    mood: 'Uneasy',
    themes: ['Boundaries', 'Guilt', 'Choosing'],
  },
  {
    daysAgo: 5,
    hour: 8,
    minute: 30,
    mode: 'journal',
    title: 'No radio',
    body: [
      'Drove home in silence. No radio. Not because I was low — because I wanted the quiet and I noticed that I wanted it. That’s new.',
    ],
    mood: 'Settled',
    themes: ['Quiet', 'Noticing', 'Something Shifting'],
  },
  {
    daysAgo: 5,
    hour: 22,
    minute: 20,
    mode: 'journal',
    title: 'Two names',
    body: [
      'Learned two names properly today. Said them out loud. Small thing, took nothing, and the whole afternoon felt different.',
    ],
    mood: 'Warm',
    themes: ['Names', 'Connection', 'Small Acts'],
  },
  {
    daysAgo: 4,
    hour: 7,
    minute: 45,
    mode: 'journal',
    title: 'Six hours',
    body: ['Slept six hours. Six. Wrote it down because I want to see if it happens again.'],
    mood: 'Hopeful',
    themes: ['Sleep', 'Noticing', 'Keeping Track'],
  },
  {
    daysAgo: 4,
    hour: 20,
    minute: 10,
    mode: 'reflection',
    title: 'It did not leave',
    body: [
      'The text:\n“Say the name.\nNot the bed,\nnot the number,\nnot the condition.\nThe name.\nIt costs you\none second\nof a day\nyou already gave away.”',
      'I’ve started doing this again without deciding to. It used to be automatic when I started out and then it stopped and now it’s coming back and I don’t know what changed.',
      'The question back:\n“You say you didn’t decide to. Something is choosing it on your behalf. What do you think that is?”',
      'Maybe the part of me that came into this in the first place. It’s still in there. It got quiet for a while but it didn’t leave.',
      'What I kept:\n“It got quiet for a while. It did not leave.”',
    ],
    mood: 'Steadier',
    themes: ['Names', 'Vocation', 'Coming Back'],
  },
  {
    daysAgo: 3,
    hour: 4,
    minute: 10,
    mode: 'journal',
    title: 'A better sandwich',
    body: [
      'Stairwell again. Same step. Ate the same sandwich. Thought: I could bring a better sandwich. Genuinely the most radical thought I’ve had all year.',
    ],
    mood: 'Wry',
    themes: ['Night Shifts', 'Small Comforts', 'Self-Care'],
  },
  {
    daysAgo: 3,
    hour: 22,
    minute: 55,
    mode: 'journal',
    title: 'Wrote it instead of not writing it',
    body: [
      'Bad shift. Properly bad. And I came home and wrote this instead of not writing it, which is the only difference between this month and February.',
    ],
    mood: 'Raw',
    themes: ['Hard Days', 'Writing It Down', 'Change'],
  },
  {
    daysAgo: 2,
    hour: 9,
    minute: 0,
    mode: 'reflection',
    title: 'Handing myself over',
    body: [
      'The text:\n“Somebody has been keeping you alive this whole time and it has not been anybody on your list.”',
      'Took me a minute to work out what this meant and then it landed hard. It’s me. It’s been me, badly, on no sleep, with no plan.',
      'The question back:\n“Badly is your word. If you were handing yourself over at the end of a shift, what would you actually say about how it had been managed?”',
      'I’d say — stable. Difficult period, no formal support in place, coped without it, would benefit from some. I’d be quite generous about it, actually. I’d never be that hard on a colleague.',
      'What I kept:\n“Difficult period. Coped without support. Would benefit from some. I would never be this hard on a colleague.”',
    ],
    mood: 'Compassionate',
    themes: ['Self-Compassion', 'Asking For Help', 'Handover'],
  },
  {
    daysAgo: 2,
    hour: 21,
    minute: 30,
    mode: 'journal',
    title: 'Bought compost and looked at it',
    body: ['Started the garden. Started is a strong word. Bought compost and looked at it.'],
    mood: 'Light',
    themes: ['The Garden', 'Beginnings', 'Life Outside Work'],
  },
  {
    daysAgo: 1,
    hour: 3,
    minute: 20,
    mode: 'journal',
    title: 'Stood in the corridor on purpose',
    body: [
      'Arrest tonight. Went well, or as well as those go. Afterwards I stood in the corridor for a bit on purpose instead of going straight back. Nobody minded.',
    ],
    mood: 'Composed',
    themes: ['Night Shifts', 'Pausing', 'Permission'],
  },
  {
    daysAgo: 1,
    hour: 8,
    minute: 15,
    mode: 'journal',
    title: 'Not the whole sky',
    body: ['The list is still the list. But it’s a list now, not the whole sky.'],
    mood: 'Clear',
    themes: ['The List', 'Perspective', 'Proportion'],
  },
  {
    daysAgo: 1,
    hour: 22,
    minute: 40,
    mode: 'journal',
    title: 'Eleven minutes',
    body: ['Registered with a GP. Took eleven minutes. Have been meaning to do it for four years.'],
    mood: 'Relieved',
    themes: ['Asking For Help', 'Self-Care', 'Overdue'],
  },
  {
    daysAgo: 0,
    hour: 7,
    minute: 30,
    mode: 'journal',
    title: 'Read February back',
    body: [
      'Read February back. Didn’t recognise the person writing it, and also recognised them completely. Both at once. Left it there.',
    ],
    mood: 'Reflective',
    themes: ['Looking Back', 'Change', 'Self-Recognition'],
  },
  {
    daysAgo: 0,
    hour: 8,
    minute: 15,
    mode: 'reflection',
    title: 'Things with edges',
    body: [
      'The text:\n“At some point\nthe list stopped being the weather\nand went back to being\na piece of paper\nin a pocket\nof a coat\nbelonging to a person\nwho has a garden now.”',
      'The garden is four pots and one of them has already died. But yes. It’s not the weather anymore. For about eight months it was the weather.',
      'The question back:\n“What did it take to make it paper again?”',
      'Writing it down, I think. Not because writing it fixed anything but because once it was on a page it was a size. It had edges. Things with edges you can put down.',
      'What I kept:\n“Once it was on the page it had edges. Things with edges, you can put down.”',
    ],
    mood: 'Grounded',
    themes: ['The List', 'Writing It Down', 'The Garden'],
  },
  {
    daysAgo: 0,
    hour: 9,
    minute: 30,
    mode: 'journal',
    title: 'Where the good stairwell is',
    body: [
      'Someone new started and looked exactly like I felt in February. Told them where the good stairwell is. It’s not nothing.',
    ],
    mood: 'Generous',
    themes: ['Colleagues', 'Passing It On', 'Small Acts'],
  },
];

/**
 * The seeded fortnight, resolved against `now`. Entries come back in the order
 * they were written, which is the order the card steps through them in.
 */
export function seedEntries(now = new Date()) {
  return SEED.map(({ daysAgo, hour, minute, ...entry }) => {
    const when = seedTime(now, daysAgo, hour, minute);
    return { id: id(), day: dayKey(when), at: when, ...entry };
  });
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

/**
 * What each mode is called on screen. The keys stay 'journal'/'reflection' —
 * they are the identifiers the seeded corpus and the saved rows are written
 * against, and renaming those would be a data migration rather than a label
 * change. This is the one place the display names live.
 */
export const MODE_LABEL = {
  journal: 'Journal Entry',
  reflection: 'Reflection',
};

/** The short form, for the toggle. */
export const MODE_NAME = {
  journal: 'Journal',
  reflection: 'Reflection',
};
