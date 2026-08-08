import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import type { Database } from '../../src/types/database.generated.js';

const MENTOR_COLUMNS = 'id, name, calendly_link, available, profile_id';

type MentorUpdate = Database['public']['Tables']['mentors']['Update'];

// Handles /api/mentors (list/create) and /api/mentors/:id (patch/delete).
export async function mentors(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  if (sub) { return byId(req, res, ctx, sub); }

  const { supabase } = ctx;

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('mentors').select(MENTOR_COLUMNS).order('name');
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'POST') {
    const profileId = typeof req.body?.profile_id === 'string' ? req.body.profile_id.trim() : '';
    if (!profileId) { badRequest(res, 'profile_id is required'); return; }

    // Mentor rows must resolve to a real profile -- the whole point of this
    // table is a live link, not a free-typed name that can drift out of
    // sync with the member's actual profile.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .eq('id', profileId)
      .maybeSingle();
    if (profileError) { throw profileError; }
    if (!profile) { badRequest(res, 'No profile found for that profile_id'); return; }
    if (profile.role !== 'mentor') { badRequest(res, 'Selected profile is not a mentor'); return; }

    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');

    const { data, error } = await supabase
      .from('mentors')
      .insert({ profile_id: profileId, name, calendly_link: req.body.calendly_link ?? null, available: req.body.available ?? false })
      .select(MENTOR_COLUMNS)
      .single();
    if (error) {
      if (error.code === '23505') { badRequest(res, 'This mentor already has a booking-availability entry'); return; }
      throw error;
    }
    sendJson(res, 201, { data });
    return;
  }

  methodNotAllowed(res, ['GET', 'POST']);
}

async function byId(req: VercelRequest, res: VercelResponse, ctx: RequestContext, id: string) {
  const { supabase } = ctx;

  if (req.method === 'PATCH') {
    const updates: MentorUpdate = {};
    if (req.body && 'available' in req.body) {
      if (typeof req.body.available !== 'boolean') { badRequest(res, 'available must be a boolean'); return; }
      updates.available = req.body.available;
    }
    if (req.body && 'calendly_link' in req.body) { updates.calendly_link = req.body.calendly_link; }

    if (Object.keys(updates).length === 0) { badRequest(res, 'No updatable fields provided'); return; }

    const { data, error } = await supabase.from('mentors').update(updates).eq('id', id).select(MENTOR_COLUMNS).single();
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('mentors').delete().eq('id', id);
    if (error) { throw error; }
    sendJson(res, 204, null);
    return;
  }

  methodNotAllowed(res, ['PATCH', 'DELETE']);
}
