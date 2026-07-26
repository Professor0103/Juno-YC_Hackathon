-- The id is fixed rather than generated. Demo determinism (PSD 4.1) requires the
-- cached fallback response to be keyed by text_id and stored in the repo, which
-- only works if the seeded row has the same id on every reset and in every
-- environment. gen_random_uuid() stays the default for every text added later.
insert into public.texts (id, title, author, body, year_published, source_note, rights, rights_note, register, tone, themes, read_seconds)
values (
  '00000000-0000-4000-8000-000000000001',
  'Surgeons must be very careful',
  'Emily Dickinson',
  E'Surgeons must be very careful\nWhen they take the knife!\nUnderneath their fine incisions\nStirs the Culprit - Life!',
  1891,
  'Fr156 / J108. First published in Poems by Emily Dickinson, Second Series (1891). [VERIFY numbering and first publication against a scholarly edition before the pitch.]',
  'public_domain',
  'Author died 1886, first published 1891. Public domain worldwide.',
  array['poem','clinical-image'],
  array['wry','unsentimental','direct'],
  array['the body','harm and care','what lies under the surface','the cost of precision'],
  15
)
on conflict (id) do nothing;
