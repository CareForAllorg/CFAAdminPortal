-- Lets an attendance-CSV upload credit each listed attendee's own service
-- hours directly (see api/_handlers/uploads.ts's uploadMapathonAttendance)
-- instead of only feeding the mapathon's aggregate totals into Impact
-- Measurables. The column identifies which service_logs rows came from a
-- given mapathon date's attendance list, so re-uploading that date's CSV
-- can cleanly delete-and-recreate its rows instead of double-crediting or
-- leaving stale entries from a corrected list.
alter table public.service_logs
  add column mapathon_date_id uuid references public.mapathon_dates(id) on delete set null;

create index service_logs_mapathon_date_id_idx on public.service_logs (mapathon_date_id) where mapathon_date_id is not null;
