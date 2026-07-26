import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const ANON = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const SEEDED_TEXT_ID = '00000000-0000-4000-8000-000000000001';

const fresh = () =>
  createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const check = (label, pass, detail) => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (!pass) process.exitCode = 1;
};

const a = fresh();
const b = fresh();

const { data: sa, error: ea } = await a.auth.signInAnonymously();
if (ea) throw ea;
const { data: sb, error: eb } = await b.auth.signInAnonymously();
if (eb) throw eb;

const userA = sa.user.id;
const userB = sb.user.id;
console.log(`user A ${userA}`);
console.log(`user B ${userB}\n`);

check('two devices are two separate anonymous users', userA !== userB);

const { data: text, error: textErr } = await a.from('texts').select('id, title').eq('id', SEEDED_TEXT_ID).single();
check('seeded text is readable by an authenticated anon user', !textErr && text?.id === SEEDED_TEXT_ID, text?.title);

const { data: inserted, error: insErr } = await a
  .from('entries')
  .insert({
    user_id: userA,
    mode: 'reflection',
    input_method: 'text',
    text_id: SEEDED_TEXT_ID,
    body: "A's private entry",
    deepening_question: 'q',
    artifact_body: 'x',
  })
  .select('id')
  .single();
check("user A can write their own entry", !insErr, insErr?.message ?? inserted?.id);

const { data: aSees } = await a.from('entries').select('id, body');
check("user A reads back exactly their own 1 row", aSees?.length === 1, `${aSees?.length} row(s)`);

// The definition-of-done check: query entries with the OTHER user's JWT.
const { data: bSees, error: bErr } = await b.from('entries').select('id, body');
check("user B's JWT returns zero rows from entries", (bSees?.length ?? 0) === 0, bErr ? bErr.message : `${bSees?.length ?? 0} row(s)`);

const { data: bTargeted } = await b.from('entries').select('id').eq('id', inserted?.id);
check("user B cannot read A's row even knowing its id", (bTargeted?.length ?? 0) === 0);

const { error: spoofErr } = await b
  .from('entries')
  .insert({ user_id: userA, mode: 'reflection', body: 'forged' });
check('user B cannot forge a row owned by user A', Boolean(spoofErr), spoofErr?.message);

const { error: updErr, data: updData } = await b.from('entries').update({ body: 'tampered' }).eq('id', inserted?.id).select('id');
check("user B cannot overwrite A's entry", (updData?.length ?? 0) === 0, updErr?.message ?? 'no rows affected');

// Leave the table empty so the crisis-path row count starts from a clean slate.
await a.from('entries').delete().eq('id', inserted?.id);
const { data: after } = await a.from('entries').select('id');
console.log(`\nentries remaining after cleanup: ${after?.length ?? 0}`);
