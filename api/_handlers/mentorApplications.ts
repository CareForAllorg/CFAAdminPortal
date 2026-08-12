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

// Handles /api/mentor-applications (list) and /api/mentor-applications/:id
// (approve/reject). "Approved" here only marks the application reviewed --
// it deliberately does not create a login account or a mentors row. That
// needs a real Supabase Auth user provisioned first, which depends on how
// the member-facing app's own signup flow creates profiles rows (a
// decision intentionally deferred rather than guessed at).
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

  const { data, error } = await ctx.supabase
    .from('mentor_applications')
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: ctx.user.id })
    .eq('id', id)
    .select('*')
    .single();
  if (error) { throw error; }

  sendJson(res, 200, { data });
}
