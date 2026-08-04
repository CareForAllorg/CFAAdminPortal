import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { methodNotAllowed, sendJson } from '../_lib/http.js';

export interface FormColumn {
  key: string;
  label: string;
}

// Raw response data for each of the "Total Portal Forms List" entries from
// the requirements -- "Form Submissions" isn't its own table anywhere;
// each of these reads straight from the real table that form's front-end
// component writes to on VolunteerPortalCFA. Returns a generic
// { data, columns } shape so one frontend table/CSV renderer covers all
// of them despite each form having a completely different field set.
export async function formSubmissions(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  switch (sub) {
    case 'members': return members(res, ctx);
    case 'chapter-lead-signups': return chapterLeadSignups(res, ctx);
    case 'chapter-applications': return chapterApplications(res, ctx);
    case 'project-submissions': return projectSubmissions(res, ctx);
    case 'mapping-mapathon-logs': return mappingMapathonLogs(res, ctx);
    case 'service-hour-verifications': return serviceHourVerifications(res, ctx);
    default:
      sendJson(res, 404, { error: `Unknown form: ${sub ?? ''}` });
  }
}

// "Become a Member" (Member Registration Sign Up) -- every onboarding
// submission, member or chapter lead alike (both fill out this shared
// personal-info section; chapter leads additionally get the fields in
// chapterLeadSignups below).
async function members(res: VercelResponse, ctx: RequestContext) {
  const { data, error } = await ctx.supabase
    .from('profiles')
    .select('id, first_name, last_name, role, gender, education_level, date_of_birth, location, interests, referral_source, created_at')
    .order('created_at', { ascending: false });
  if (error) { throw error; }

  const columns: FormColumn[] = [
    { key: 'first_name', label: 'First Name' }, { key: 'last_name', label: 'Last Name' },
    { key: 'role', label: 'Role' }, { key: 'gender', label: 'Gender' },
    { key: 'education_level', label: 'Education Level' }, { key: 'date_of_birth', label: 'Date of Birth' },
    { key: 'location', label: 'Location' }, { key: 'interests', label: 'Interests' },
    { key: 'referral_source', label: 'Referral Source' }, { key: 'created_at', label: 'Submitted' },
  ];
  sendJson(res, 200, { data, columns, total: (data ?? []).length });
}

// "Start a Chapter" (Chapter Registration Sign Up) -- the onboarding-time
// path (StepChapterLead.tsx), distinct from the post-onboarding
// "Chapter Application Form" independent members file later from Chapter
// Hub (see chapterApplications below). Only rows that actually went
// through that step have chapter_name set.
async function chapterLeadSignups(res: VercelResponse, ctx: RequestContext) {
  const { data, error } = await ctx.supabase
    .from('profiles')
    .select('id, first_name, last_name, chapter_name, chapter_type, chapter_location, co_lead_info, over_18, advisor_name, advisor_email, created_at')
    .not('chapter_name', 'is', null)
    .order('created_at', { ascending: false });
  if (error) { throw error; }

  const columns: FormColumn[] = [
    { key: 'first_name', label: 'First Name' }, { key: 'last_name', label: 'Last Name' },
    { key: 'chapter_name', label: 'Chapter Name' }, { key: 'chapter_type', label: 'Chapter Type' },
    { key: 'chapter_location', label: 'Location' }, { key: 'co_lead_info', label: 'Co-Lead' },
    { key: 'over_18', label: '18+' }, { key: 'advisor_name', label: 'Advisor' },
    { key: 'advisor_email', label: 'Advisor Email' }, { key: 'created_at', label: 'Submitted' },
  ];
  sendJson(res, 200, { data, columns, total: (data ?? []).length });
}

// "Chapter Application Form (from independent members)" -- the Chapter
// Hub "Start a Chapter" modal an already-onboarded independent_member
// fills out later. Stored in chapters.meta (see
// VolunteerPortalCFA's POST /api/chapters), not on profiles.
async function chapterApplications(res: VercelResponse, ctx: RequestContext) {
  const { data, error } = await ctx.supabase
    .from('chapters')
    .select('id, name, status, meta, created_at')
    .order('created_at', { ascending: false });
  if (error) { throw error; }

  const rows = (data ?? []).map((c) => {
    const meta = (c.meta ?? {}) as Record<string, unknown>;
    return {
      id: c.id,
      chapter_name: c.name,
      status: c.status,
      applicant_name: meta.applicant_name ?? null,
      applicant_email: meta.applicant_email ?? null,
      school_or_community: meta.application_school_name ?? null,
      city: meta.application_city ?? null,
      state: meta.application_state ?? null,
      country: meta.application_country ?? null,
      cofounder: meta.application_cofounder_info ?? null,
      additional_member: meta.application_additional_member_info ?? null,
      advisor: meta.application_advisor_info ?? null,
      applied_at: meta.applied_at ?? c.created_at,
    };
  });

  const columns: FormColumn[] = [
    { key: 'chapter_name', label: 'Chapter Name' }, { key: 'status', label: 'Status' },
    { key: 'applicant_name', label: 'Applicant' }, { key: 'applicant_email', label: 'Applicant Email' },
    { key: 'school_or_community', label: 'School/Community' }, { key: 'city', label: 'City' },
    { key: 'state', label: 'State' }, { key: 'country', label: 'Country' },
    { key: 'cofounder', label: 'Co-Founder' }, { key: 'additional_member', label: 'Additional Member' },
    { key: 'advisor', label: 'Advisor' }, { key: 'applied_at', label: 'Applied' },
  ];
  sendJson(res, 200, { data: rows, columns, total: rows.length });
}

// "Project Time Log for service hour tracking" -- Project Hub's
// start-a-project wizard + wrap-up activity summary. `data` is freeform
// jsonb that varies by project type, so it's surfaced as one JSON column
// rather than guessing a fixed field list.
async function projectSubmissions(res: VercelResponse, ctx: RequestContext) {
  const { data, error } = await ctx.supabase
    .from('projects')
    .select('id, user_id, name, type, scope, status, deadline, prep, impl, wrapup, data, created_at')
    .order('created_at', { ascending: false });
  if (error) { throw error; }

  const rows = (data ?? []).map((p) => ({ ...p, data: JSON.stringify(p.data ?? {}) }));

  const columns: FormColumn[] = [
    { key: 'name', label: 'Project Name' }, { key: 'type', label: 'Type' }, { key: 'scope', label: 'Scope' },
    { key: 'status', label: 'Status' }, { key: 'deadline', label: 'Deadline' },
    { key: 'prep', label: 'Prep Done' }, { key: 'impl', label: 'Implementation Done' }, { key: 'wrapup', label: 'Wrapped Up' },
    { key: 'data', label: 'Full Submission (JSON)' }, { key: 'created_at', label: 'Created' },
  ];
  sendJson(res, 200, { data: rows, columns, total: rows.length });
}

// "Mapping & Mapathon Time Log for service hour tracking" -- every
// mapping/mapathon service_logs submission, any status (an audit log of
// raw responses, not the pending-only Approvals queue).
async function mappingMapathonLogs(res: VercelResponse, ctx: RequestContext) {
  const { data, error } = await ctx.supabase
    .from('service_logs')
    .select('id, name, email, activity_type, hours, status, description, primary_impact, impact_magnitude, submitted_at')
    .ilike('activity_type', '%map%')
    .order('submitted_at', { ascending: false });
  if (error) { throw error; }

  const columns: FormColumn[] = [
    { key: 'name', label: 'Member' }, { key: 'email', label: 'Email' }, { key: 'activity_type', label: 'Activity' },
    { key: 'hours', label: 'Hours' }, { key: 'status', label: 'Status' },
    { key: 'primary_impact', label: 'Impact Type' }, { key: 'impact_magnitude', label: 'Impact Amount' },
    { key: 'description', label: 'Description' }, { key: 'submitted_at', label: 'Submitted' },
  ];
  sendJson(res, 200, { data, columns, total: (data ?? []).length });
}

// "Service Hour Verification Form" -- the general Service Hours page
// (mentorship, impact hours, org-verified hours, etc.) -- everything
// that isn't mapping/mapathon (its own form above) or a project wrap-up
// (its own form above).
async function serviceHourVerifications(res: VercelResponse, ctx: RequestContext) {
  const { data, error } = await ctx.supabase
    .from('service_logs')
    .select('id, name, email, org_name, activity_type, hours, status, verify_method, verification_completed, description, submitted_at')
    .not('activity_type', 'ilike', '%map%')
    .not('activity_type', 'ilike', '%project%')
    .order('submitted_at', { ascending: false });
  if (error) { throw error; }

  const columns: FormColumn[] = [
    { key: 'name', label: 'Member' }, { key: 'email', label: 'Email' }, { key: 'org_name', label: 'Organization' },
    { key: 'activity_type', label: 'Activity' }, { key: 'hours', label: 'Hours' }, { key: 'status', label: 'Status' },
    { key: 'verify_method', label: 'Verify Method' }, { key: 'verification_completed', label: 'Verified' },
    { key: 'description', label: 'Description' }, { key: 'submitted_at', label: 'Submitted' },
  ];
  sendJson(res, 200, { data, columns, total: (data ?? []).length });
}
