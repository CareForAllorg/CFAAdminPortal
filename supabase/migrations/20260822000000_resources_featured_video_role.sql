-- Lets a resource opt into the highlighted/featured card look (used by the
-- member portal's "Join our Discord" card) and, for the role-specific
-- onboarding-video rows, records which viewer role that particular video is
-- for -- previously both were hardcoded directly in the member portal's
-- MemberDashboard.tsx instead of coming from this table.
alter table public.resources
  add column featured boolean not null default false,
  add column video_role text;
