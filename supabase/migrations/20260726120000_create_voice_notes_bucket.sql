-- The bucket the voice-note policies (20260725160037) already scope to. Those
-- policies were written first and reference a bucket that was never created,
-- so every upload failed before this.
--
-- Private: recordings are read back only through the transcribe-voice-note
-- function, under the caller's own {auth.uid()}/ prefix.
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;
