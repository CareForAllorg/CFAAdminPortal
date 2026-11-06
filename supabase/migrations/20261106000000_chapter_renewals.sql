-- Annual Chapter Renewal Form submissions (due June 1 each year). Members
-- file them from Chapter Hub in the volunteer portal (service-role key, so
-- RLS there is not the gate); the admin portal reads via the admin JWT.
-- Leads can edit their submission for the current cycle (one row per chapter
-- per year, updated in place).
-- Record-only: nothing here updates the chapter's actual leads/advisor/type.

create table if not exists public.chapter_renewals (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  -- The year of the June 1 deadline this submission counts toward.
  cycle_year int not null,
  lead1_name text not null,
  lead1_email text not null,
  lead2_name text,
  lead2_email text,
  advisor_name text not null,
  advisor_email text not null,
  chapter_type text not null check (chapter_type in ('community', 'school')),
  other_changes text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chapter_id, cycle_year)
);

create index if not exists chapter_renewals_chapter_idx on public.chapter_renewals (chapter_id);

alter table public.chapter_renewals enable row level security;

create policy "Admins manage chapter renewals" on public.chapter_renewals
  for all using (auth.jwt() ->> 'user_role' = 'admin')
  with check (auth.jwt() ->> 'user_role' = 'admin');
