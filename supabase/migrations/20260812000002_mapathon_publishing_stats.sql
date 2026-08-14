-- Mapathon publishing: admins self-report a mapathon's total buildings/
-- roads mapped and any bonus service hours when they schedule the date
-- (these are NOT calculated from member submissions -- see the Impact
-- Measurables requirement that these get added on top of the
-- replace-with-latest per-member totals), plus an attendance list upload.
alter table public.mapathon_dates add column if not exists total_buildings_mapped integer not null default 0;
alter table public.mapathon_dates add column if not exists total_km_roads_mapped numeric not null default 0;
alter table public.mapathon_dates add column if not exists bonus_service_hours numeric not null default 0;
alter table public.mapathon_dates add column if not exists attendance_list_path text;

-- Private bucket: attendance lists contain attendee names/emails, unlike
-- mentor-avatars (meant to be publicly visible) -- read access goes
-- through a signed URL, same pattern as proof-uploads.
insert into storage.buckets (id, name, public)
values ('mapathon-attendance', 'mapathon-attendance', false)
on conflict (id) do nothing;

drop policy if exists "Admins can read mapathon attendance" on storage.objects;
create policy "Admins can read mapathon attendance"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'mapathon-attendance' and is_admin());

drop policy if exists "Admins can upload mapathon attendance" on storage.objects;
create policy "Admins can upload mapathon attendance"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'mapathon-attendance' and is_admin());

drop policy if exists "Admins can replace mapathon attendance" on storage.objects;
create policy "Admins can replace mapathon attendance"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'mapathon-attendance' and is_admin())
  with check (bucket_id = 'mapathon-attendance' and is_admin());

drop policy if exists "Admins can delete mapathon attendance" on storage.objects;
create policy "Admins can delete mapathon attendance"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'mapathon-attendance' and is_admin());
