import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import { supabaseServiceRole } from '../_lib/supabaseServer.js';

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) { return []; }
  return value.filter((v): v is string => typeof v === 'string');
}

// Google Apps Script has no Supabase session to authenticate as, so this
// route is dispatched *before* requireAdmin in api/handler.ts and gated
// by its own shared secret instead. See the Apps Script snippet in the
// PR description for the trigger that posts here on form submit.
export async function mentorApplicationsWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  const secret = req.headers['x-webhook-secret'];
  if (!process.env.MENTOR_FORM_WEBHOOK_SECRET || secret !== process.env.MENTOR_FORM_WEBHOOK_SECRET) {
    sendJson(res, 401, { error: 'Invalid or missing webhook secret' });
    return;
  }

  const body = req.body ?? {};
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!fullName || !email) { badRequest(res, 'full_name and email are required'); return; }

  const { error } = await supabaseServiceRole().from('mentor_applications').insert({
    full_name: fullName,
    email,
    date_of_birth: body.date_of_birth ?? null,
    gender: body.gender ?? null,
    location: body.location ?? null,
    headshot_url: body.headshot_url ?? null,
    bio: body.bio ?? null,
    calendly_link: body.calendly_link ?? null,
    professional_background: toStringArray(body.professional_background),
    can_help_with: toStringArray(body.can_help_with),
    comfortable_mentoring: toStringArray(body.comfortable_mentoring),
    agreed_mentor_participation: body.agreed_mentor_participation === true,
    agreed_general_participation: body.agreed_general_participation === true,
    agreed_media_release: body.agreed_media_release === true,
    bscp_newsletter_optin: typeof body.bscp_newsletter_optin === 'boolean' ? body.bscp_newsletter_optin : null,
  });
  if (error) { throw error; }

  sendJson(res, 201, { ok: true });
}

// profiles.gender is a Postgres enum (gender_type), not free text -- the
// form's raw radio-button values ("Woman", "Non-Binary", ...) don't match
// its labels ("Female", "Nonbinary", ...) verbatim. Anything unrecognized
// (including whatever a respondent typed into the form's free-text
// "Other:" option) falls back to the enum's own 'Other' label rather than
// failing the whole provisioning step.
const GENDER_MAP: Record<string, string> = {
  man: 'Male',
  woman: 'Female',
  'non-binary': 'Nonbinary',
  'prefer not to say': 'Prefer Not to Say',
  other: 'Other',
};
function mapGender(raw: string | null): string | null {
  if (!raw) { return null; }
  return GENDER_MAP[raw.trim().toLowerCase()] ?? 'Other';
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const trimmed = fullName.trim();
  const spaceIdx = trimmed.indexOf(' ');
  return spaceIdx === -1
    ? { first_name: trimmed, last_name: '' }
    : { first_name: trimmed.slice(0, spaceIdx), last_name: trimmed.slice(spaceIdx + 1).trim() };
}

// Provisions a real account for an approved application: an invited
// Supabase Auth user (auth.admin.inviteUserByEmail sends the actual
// invite/password-setup email -- no temp password ever passes through
// this admin UI), the public.users row profiles.id requires (there's no
// trigger that creates this automatically for auth-API-created users,
// confirmed the hard way provisioning the CareForAll admin account
// manually), a profiles row with role 'mentor', and the mentors row this
// admin app's booking-availability list reads.
async function provisionMentorAccount(application: {
  id: string; full_name: string; email: string; date_of_birth: string | null;
  gender: string | null; location: string | null; calendly_link: string | null;
  agreed_general_participation: boolean; agreed_media_release: boolean;
}) {
  const admin = supabaseServiceRole();
  const { first_name, last_name } = splitName(application.full_name);

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(application.email);
  let userId: string;
  if (inviteError) {
    // Re-approving (or a prior partial failure) shouldn't crash on "user
    // already registered" -- look up the existing account instead of
    // treating it as fatal.
    if (!inviteError.message.toLowerCase().includes('already been registered')) { throw inviteError; }
    const { data: existing, error: listError } = await admin.auth.admin.listUsers();
    if (listError) { throw listError; }
    const match = existing.users.find((u) => u.email?.toLowerCase() === application.email.toLowerCase());
    if (!match) { throw inviteError; }
    userId = match.id;
  } else {
    userId = invited.user.id;
  }

  const { error: userError } = await admin
    .from('users')
    .upsert({ id: userId, email: application.email, name: application.full_name }, { onConflict: 'id' });
  if (userError) { throw userError; }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    first_name,
    last_name,
    role: 'mentor',
    date_of_birth: application.date_of_birth,
    gender: mapGender(application.gender),
    location: application.location,
    calendly_url: application.calendly_link,
    agreed_general_participation: application.agreed_general_participation,
    agreed_media_release: application.agreed_media_release,
  }, { onConflict: 'id' });
  if (profileError) { throw profileError; }

  const { error: mentorError } = await admin
    .from('mentors')
    .upsert({ profile_id: userId, name: application.full_name, calendly_link: application.calendly_link, available: false }, { onConflict: 'profile_id' });
  if (mentorError) { throw mentorError; }
}

// Handles /api/mentor-applications (list) and /api/mentor-applications/:id
// (approve/reject). Approving provisions a real account (see
// provisionMentorAccount above); rejecting just marks the application
// reviewed.
export async function mentorApplications(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  if (sub) { return byId(req, res, ctx, sub); }

  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const { data, error } = await ctx.supabase
    .from('mentor_applications')
    .select('*')
    .order('submitted_at', { ascending: false });
  if (error) { throw error; }

  sendJson(res, 200, { data });
}

async function byId(req: VercelRequest, res: VercelResponse, ctx: RequestContext, id: string) {
  if (req.method !== 'PATCH') {
    methodNotAllowed(res, ['PATCH']);
    return;
  }

  const status = req.body?.status;
  if (status !== 'approved' && status !== 'rejected') {
    badRequest(res, "status must be 'approved' or 'rejected'");
    return;
  }

  if (status === 'approved') {
    const { data: application, error: fetchError } = await ctx.supabase
      .from('mentor_applications')
      .select('id, full_name, email, date_of_birth, gender, location, calendly_link, agreed_general_participation, agreed_media_release')
      .eq('id', id)
      .single();
    if (fetchError) { throw fetchError; }

    await provisionMentorAccount(application);
  }

  const { data, error } = await ctx.supabase
    .from('mentor_applications')
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: ctx.user.id })
    .eq('id', id)
    .select('*')
    .single();
  if (error) { throw error; }

  sendJson(res, 200, { data });
}
