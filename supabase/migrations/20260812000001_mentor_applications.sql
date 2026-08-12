-- Staging table for "Become a Mentor" Google Form submissions. The form
-- has no way to authenticate as a Supabase user (it's filled out by
-- non-members), so a Google Apps Script trigger posts each response to
-- a webhook endpoint that inserts here using the service-role key,
-- bypassing RLS entirely -- there is deliberately no insert policy for
-- the `authenticated`/`anon` roles on this table.
--
-- Column names mirror the form's actual sections/fields (confirmed
-- directly against form screenshots, not guessed): personal info,
-- profile setup, background/preferences, and agreements. Admins review
-- these here and decide whether to promote one into a real profile +
-- mentors row (that promotion step -- which needs to create an actual
-- Supabase Auth user -- is a separate, larger piece of work, not part of
-- this table).
create table if not exists public.mentor_applications (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  full_name text not null,
  email text not null,
  date_of_birth date,
  gender text,
  location text,
  headshot_url text,
  bio text,
  calendly_link text,
  professional_background text[] not null default '{}',
  can_help_with text[] not null default '{}',
  comfortable_mentoring text[] not null default '{}',
  agreed_mentor_participation boolean not null default false,
  agreed_general_participation boolean not null default false,
  agreed_media_release boolean not null default false,
  bscp_newsletter_optin boolean,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id)
);

alter table public.mentor_applications enable row level security;

drop policy if exists "Admins can read mentor applications" on public.mentor_applications;
create policy "Admins can read mentor applications"
  on public.mentor_applications for select
  to authenticated
  using (is_admin());

drop policy if exists "Admins can update mentor applications" on public.mentor_applications;
create policy "Admins can update mentor applications"
  on public.mentor_applications for update
  to authenticated
  using (is_admin())
  with check (is_admin());
