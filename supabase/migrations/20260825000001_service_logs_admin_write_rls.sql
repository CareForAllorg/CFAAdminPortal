-- `service_logs` has RLS enabled with no admin INSERT/DELETE policy, so
-- api/_handlers/uploads.ts's uploadMapathonAttendance -- which inserts one
-- approved service_logs row per matched attendee, and deletes a mapathon
-- date's previous rows before re-crediting on re-upload -- was rejected
-- outright by RLS instead of silently matching 0 rows (INSERT/DELETE with
-- no matching policy errors rather than no-ops, unlike UPDATE). Same class
-- of RLS gap as chapters/profiles/resources elsewhere in this repo, fixed
-- the same way: an is_admin()-gated policy, matching the pattern
-- consolidated in 20260709000006_use_is_admin_for_rls.sql.
drop policy if exists "Admins can insert service logs" on public.service_logs;
create policy "Admins can insert service logs"
  on public.service_logs for insert
  to authenticated
  with check (is_admin());

drop policy if exists "Admins can delete service logs" on public.service_logs;
create policy "Admins can delete service logs"
  on public.service_logs for delete
  to authenticated
  using (is_admin());
