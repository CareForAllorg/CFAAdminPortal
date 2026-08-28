-- Lets an admin reorder resources within a category (e.g. Discord after
-- Photo & Video Submissions) instead of the list only ever reflecting
-- whatever order rows happened to be inserted in.
alter table public.resources
  add column sort_order integer not null default 0;

-- Backfill existing rows with the same order they already display in
-- (category, then title) so this migration doesn't visibly reshuffle
-- anyone's current list -- from here on, sort_order is the real order.
with numbered as (
  select id, row_number() over (partition by category order by title) - 1 as rn
  from public.resources
)
update public.resources
set sort_order = numbered.rn
from numbered
where public.resources.id = numbered.id;
