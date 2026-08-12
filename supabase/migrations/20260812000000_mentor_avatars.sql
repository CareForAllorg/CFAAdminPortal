-- Mentor profile pictures live on profiles.avatar_url (not a mentors-
-- table column) so the member-facing app -- which already reads a
-- mentor's name/Calendly link through profile_id rather than this admin
-- app's mentors table (see the profile_id FK work) -- picks up the same
-- photo without needing its own sync path.
alter table public.profiles add column if not exists avatar_url text;

-- Public bucket: avatar photos are meant to be visible to any member
-- viewing a mentor's profile, not gated behind a signed URL like
-- proof-uploads (private, member-submitted verification photos).
insert into storage.buckets (id, name, public)
values ('mentor-avatars', 'mentor-avatars', true)
on conflict (id) do nothing;

-- A bucket's `public: true` flag only exempts the special public-URL
-- serving route (/storage/v1/object/public/...) from RLS -- it does NOT
-- exempt ordinary authenticated-role table access to storage.objects.
-- upload()'s upsert:true does an internal existence check that needs a
-- real SELECT policy to resolve under RLS; without one here, every
-- upload failed with a generic "new row violates row-level security
-- policy" even though the INSERT policy's own with_check was satisfied
-- (confirmed via is_admin() returning true for the failing request).
-- Matches "Public read access to avatars" on the pre-existing `avatars`
-- bucket -- these photos are meant to be publicly viewable anyway.
drop policy if exists "Public read access to mentor avatars" on storage.objects;
create policy "Public read access to mentor avatars"
  on storage.objects for select
  to public
  using (bucket_id = 'mentor-avatars');

drop policy if exists "Admins can upload mentor avatars" on storage.objects;
create policy "Admins can upload mentor avatars"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'mentor-avatars' and is_admin());

drop policy if exists "Admins can replace mentor avatars" on storage.objects;
create policy "Admins can replace mentor avatars"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'mentor-avatars' and is_admin())
  with check (bucket_id = 'mentor-avatars' and is_admin());

drop policy if exists "Admins can delete mentor avatars" on storage.objects;
create policy "Admins can delete mentor avatars"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'mentor-avatars' and is_admin());
