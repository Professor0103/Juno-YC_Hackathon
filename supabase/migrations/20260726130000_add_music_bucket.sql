-- Background music for the stage.
--
-- Public, unlike voice-notes. The tracks are the same three files for everyone,
-- they carry nothing about anybody, and the <audio> element has to be able to
-- fetch them with byte-range requests before there is a session — so a signed
-- URL would be both pointless and worse: it expires mid-track and it cannot be
-- cached by the browser. Nothing user-written is ever written here; the bucket
-- holds exactly what this repo puts in it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('music', 'music', true, 20971520, array['audio/mpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A public bucket is already readable over /object/public, so this policy is
-- what makes the same objects listable and readable through the storage API
-- for any caller, signed in or not. Read only: no insert, update or delete
-- policy exists for this bucket, so the anon and authenticated roles cannot
-- write to it at all and uploads stay a deploy-time act.
drop policy if exists "music is readable by anyone" on storage.objects;
create policy "music is readable by anyone"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'music');
