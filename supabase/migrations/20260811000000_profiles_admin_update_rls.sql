-- `profiles` has RLS enabled with no admin UPDATE policy, so
-- api/_handlers/serviceLogs.ts's approval handler -- which writes
-- buildings_mapped/km_roads_mapped onto a *different* user's profile row
-- when an admin approves a Mapping service_logs entry -- was silently
-- matching 0 rows (not erroring) on `.update(...).eq('id', data.user_id)`.
-- The handler saw a null error and reported success while the member's
-- dashboard stats never moved. Same class of bug as chapters in
-- 20260709000001_chapters_admin_write_rls.sql, fixed the same way: an
-- is_admin()-gated UPDATE policy, matching the pattern consolidated in
-- 20260709000006_use_is_admin_for_rls.sql.
drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles for update
  to authenticated
  using (is_admin())
  with check (is_admin());
