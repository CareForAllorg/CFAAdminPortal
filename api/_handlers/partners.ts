import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import type { Database } from '../../src/types/database.generated.js';

const PARTNER_COLUMNS = 'id, name, website, contact_name, contact_first_name, contact_last_name, contact_email, notes, created_at';

type PartnerUpdate = Database['public']['Tables']['partners']['Update'];

const PATCHABLE_FIELDS = ['name', 'website', 'contact_first_name', 'contact_last_name', 'contact_email', 'notes'] as const satisfies readonly (keyof PartnerUpdate)[];

// A member self-signing up as a "Program Partner" creates a real chapter
// instead (see VolunteerPortalCFA's app/onboarding/actions.ts) -- a
// program partner is a chapter under the hood, reviewed the same way as
// any other chapter application. This table is for CareForAll staff to add
// partner organizations by hand -- pure admin CRUD, no member-facing
// counterpart.
export async function partners(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
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
    sendJson(res, 201, { data });
    return;
  }

  methodNotAllowed(res, ['GET', 'POST']);
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
