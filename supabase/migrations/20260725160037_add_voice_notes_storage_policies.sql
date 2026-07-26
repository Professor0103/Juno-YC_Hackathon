-- Users may only access voice notes stored under their own {auth.uid()}/ prefix.
create policy "users can upload their own voice notes"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'voice-notes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can read their own voice notes"
on storage.objects for select
to authenticated
using (
  bucket_id = 'voice-notes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can update their own voice notes"
on storage.objects for update
to authenticated
using (
  bucket_id = 'voice-notes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can delete their own voice notes"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'voice-notes'
  and (storage.foldername(name))[1] = auth.uid()::text
);
