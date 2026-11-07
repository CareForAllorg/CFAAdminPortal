import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import type { Database } from '../../src/types/database.generated.js';

const PARTNER_COLUMNS = 'id, name, website, contact_name, contact_first_name, contact_last_name, contact_email, notes, created_at';

const VOLUNTEER_PORTAL_URL = process.env.VOLUNTEER_PORTAL_URL ?? 'https://volunteer.careforall.org';

type PartnerUpdate = Database['public']['Tables']['partners']['Update'];

const PATCHABLE_FIELDS = ['name', 'website', 'contact_first_name', 'contact_last_name', 'contact_email', 'notes'] as const satisfies readonly (keyof PartnerUpdate)[];

// Asks the volunteer portal (which owns the Resend setup) to email the
// partner contact an invite to the Program Partner signup. Authenticated
// with the shared PARTNER_INVITE_SECRET (same value in both Vercel
// projects). Failure is reported, never thrown -- the partner row is
// already saved by the time this runs.
async function sendPartnerInvite(email: string, firstName: string | null, orgName: string): Promise<string | null> {
  const secret = process.env.PARTNER_INVITE_SECRET;
  if (!secret) { return 'PARTNER_INVITE_SECRET is not set in the admin portal'; }
  try {
    const res = await fetch(`${VOLUNTEER_PORTAL_URL}/api/partners/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-partner-invite-secret': secret,
        // Lets server-to-server calls through Vercel Authentication on preview deployments.
        ...(process.env.VOLUNTEER_PORTAL_BYPASS ? { 'x-vercel-protection-bypass': process.env.VOLUNTEER_PORTAL_BYPASS } : {}),
      },
      body: JSON.stringify({ email, firstName: firstName ?? undefined, orgName }),
    });
    if (!res.ok) { return `Volunteer portal responded ${res.status}`; }
    return null;
  } catch (err) {
    console.error('[partners] invite failed:', err);
    return err instanceof Error ? err.message : 'Could not reach the volunteer portal';
  }
}

// A member self-signing up as a "Program Partner" creates a real chapter
// instead (see VolunteerPortalCFA's app/onboarding/actions.ts) -- a
// program partner is a chapter under the hood, reviewed the same way as
// any other chapter application. This table is for CareForAll staff to add
// partner organizations by hand -- pure admin CRUD, no member-facing
// counterpart.
export async function partners(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  const rawPath = req.query.path;
  const action = (Array.isArray(rawPath) ? rawPath.join('/') : rawPath ?? '').split('/').filter(Boolean)[2];
  if (sub && action === 'invite') { return resendInvite(req, res, ctx, sub); }
  if (sub) { return byId(req, res, ctx, sub); }

  const { supabase } = ctx;

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('partners').select(PARTNER_COLUMNS).order('name');
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'POST') {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) { badRequest(res, 'name is required'); return; }

    const { data, error } = await supabase
      .from('partners')
      .insert({
        name,
        website: req.body.website || null,
        contact_first_name: req.body.contact_first_name || null,
        contact_last_name: req.body.contact_last_name || null,
        contact_email: req.body.contact_email || null,
        notes: req.body.notes || null,
      })
      .select(PARTNER_COLUMNS)
      .single();
    if (error) { throw error; }

    // Adding an organization with a contact email is what invites that
    // contact to create their partnership account.
    let inviteError: string | null = null;
    if (data.contact_email) {
      inviteError = await sendPartnerInvite(data.contact_email, data.contact_first_name, data.name);
    }
    sendJson(res, 201, { data, invited: !!data.contact_email && !inviteError, inviteError });
    return;
  }

  methodNotAllowed(res, ['GET', 'POST']);
}

// Manual (re)send of the partnership invite to an existing partner's contact.
async function resendInvite(req: VercelRequest, res: VercelResponse, ctx: RequestContext, id: string) {
  if (req.method !== 'POST') { methodNotAllowed(res, ['POST']); return; }
  const { data, error } = await ctx.supabase.from('partners').select(PARTNER_COLUMNS).eq('id', id).single();
  if (error) { throw error; }
  if (!data.contact_email) { badRequest(res, 'This partner has no contact email. Edit the partner and add one first.'); return; }

  const inviteError = await sendPartnerInvite(data.contact_email, data.contact_first_name, data.name);
  sendJson(res, 200, { invited: !inviteError, inviteError, email: data.contact_email });
}

async function byId(req: VercelRequest, res: VercelResponse, ctx: RequestContext, id: string) {
  const { supabase } = ctx;

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('partners').select(PARTNER_COLUMNS).eq('id', id).single();
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'PATCH') {
    const updates: PartnerUpdate = {};
    for (const field of PATCHABLE_FIELDS) {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if ('name' in updates && !updates.name?.trim()) { badRequest(res, 'name must be a non-empty string'); return; }
    if (Object.keys(updates).length === 0) { badRequest(res, 'No updatable fields provided'); return; }

    const { data, error } = await supabase.from('partners').update(updates).eq('id', id).select(PARTNER_COLUMNS).single();
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('partners').delete().eq('id', id);
    if (error) { throw error; }
    sendJson(res, 204, null);
    return;
  }

  methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
}
