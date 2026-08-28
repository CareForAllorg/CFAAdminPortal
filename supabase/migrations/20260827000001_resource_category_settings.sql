-- Lets an admin hide an entire resource section (e.g. Project Toolkits)
-- from the member dashboard regardless of whether it still has published
-- items in it -- distinct from hiding individual resources one at a time,
-- and from the automatic "hide when empty" behavior already in place.
create table public.resource_category_settings (
  category text primary key,
  hidden boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.resource_category_settings enable row level security;

-- Matches resources' own "Anyone can view" policy -- the member-facing
-- app needs to read this to know which sections to skip.
create policy "Anyone can view resource category settings"
  on public.resource_category_settings for select
  to public
  using (true);

create policy "Admins can insert resource category settings"
  on public.resource_category_settings for insert
  to authenticated
  with check (is_admin());

create policy "Admins can update resource category settings"
  on public.resource_category_settings for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create or replace function public.set_resource_category_settings_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger resource_category_settings_set_updated_at
  before update on public.resource_category_settings
  for each row
  execute function public.set_resource_category_settings_updated_at();
