-- Placeholder slots for the three mentor guides. No link yet and status
-- 'coming-soon' so nothing shows to mentors until an admin adds the link
-- (Edit) and unhides each one in the Resources Manager.
insert into public.resources (category, title, description, link, source_type, audience, status, sort_order)
select 'Mentor Guides', v.title, v.description, null, 'External Link', 'Mentors', 'coming-soon', v.ord
from (values
  ('Impact Hour Guide', 'How mentors log and run impact hours', 0),
  ('Check-In Guide', 'How mentors run quarterly chapter check-ins', 1),
  ('Office Hour Guide', 'How mentors hold office hours', 2)
) as v(title, description, ord)
where not exists (
  select 1 from public.resources r where r.category = 'Mentor Guides' and r.title = v.title
);
