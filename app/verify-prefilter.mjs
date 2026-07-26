import { looksLikeCrisis } from './src/lib/prefilter.js';

// [expected, text]
const CASES = [
  // Must flag — first-person crisis.
  [true, "I don't want to be here anymore."],
  [true, 'I have been thinking about killing myself.'],
  [true, 'some days I want to die'],
  [true, 'I keep thinking I would be better off dead'],
  [true, "I can't go on like this"],
  [true, 'there is no reason to live'],
  [true, 'no point in living'],
  [true, "there's no point going on"],
  [true, 'I have been having suicidal thoughts since the weekend'],
  [true, 'I hurt myself again last night'],

  // Must NOT flag — clinical narration, the failure mode that matters.
  [false, 'The patient took an overdose on Tuesday and we could not bring her back.'],
  [false, 'We lost him to suicide. I wrote the notes up afterwards.'],
  [false, 'Third self-harm presentation of the shift.'],
  [false, 'She said she wanted to die and I just held her hand.'],
  [false, 'He was found after an overdose and I was the one who called it.'],
  [false, 'I sat with a patient who was suicidal for four hours.'],

  // Must NOT flag — exhaustion and idiom, which this population writes constantly.
  [false, 'This rota is going to kill me.'],
  [false, 'I am completely burnt out and I hate this job.'],
  [false, 'I am so tired I could sleep for a week.'],
  [false, 'I have nothing left to give anyone.'],
  [false, 'Dead on my feet after that shift.'],
  [false, ''],
];

let failures = 0;
for (const [expected, text] of CASES) {
  const actual = looksLikeCrisis(text);
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${expected ? 'flag  ' : 'clear '}  ${JSON.stringify(text).slice(0, 70)}`,
  );
}

console.log(`\n${CASES.length - failures}/${CASES.length} cases correct`);
process.exitCode = failures > 0 ? 1 : 0;
