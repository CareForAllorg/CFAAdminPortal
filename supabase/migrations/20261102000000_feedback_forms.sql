-- Admin-designed feedback forms released to specific members or roles.
-- Members answer them in the volunteer portal (service-role key, so RLS
-- there is not the gate); the admin portal reads/writes via the admin JWT.

create table if not exists public.feedback_forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  questions jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'released')),
  target_roles text[] not null default '{}',
  target_user_ids uuid[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create table if not exists public.feedback_form_recipients (
  form_id uuid not null references public.feedback_forms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  notified_at timestamptz,
  primary key (form_id, user_id)
);

create table if not exists public.feedback_form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.feedback_forms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  unique (form_id, user_id)
);

create index if not exists feedback_form_recipients_user_idx on public.feedback_form_recipients (user_id);
create index if not exists feedback_form_responses_form_idx on public.feedback_form_responses (form_id);

alter table public.feedback_forms enable row level security;
alter table public.feedback_form_recipients enable row level security;
alter table public.feedback_form_responses enable row level security;

create policy "Admins manage feedback forms" on public.feedback_forms
  for all using (auth.jwt() ->> 'user_role' = 'admin')
  with check (auth.jwt() ->> 'user_role' = 'admin');

create policy "Admins manage feedback form recipients" on public.feedback_form_recipients
  for all using (auth.jwt() ->> 'user_role' = 'admin')
  with check (auth.jwt() ->> 'user_role' = 'admin');

create policy "Admins manage feedback form responses" on public.feedback_form_responses
  for all using (auth.jwt() ->> 'user_role' = 'admin')
  with check (auth.jwt() ->> 'user_role' = 'admin');
