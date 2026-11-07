-- Program partners are organizations, so the renewal form has no chapter type
-- for them. Allow it to be null.
alter table public.chapter_renewals alter column chapter_type drop not null;
