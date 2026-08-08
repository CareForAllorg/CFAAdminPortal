import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import type { Database } from '../../src/types/database.generated.js';

const MAPATHON_DATE_COLUMNS = 'id, event_date, hours, label, created_at';

type MapathonDateUpdate = Database['public']['Tables']['mapathon_dates']['Update'];

const PATCHABLE_FIELDS = ['event_date', 'hours', 'label'] as const satisfies readonly (keyof MapathonDateUpdate)[];

// Admin-configured mapathon dates + associated hours -- the member-facing
// Mapathon Time Log form (VolunteerPortalCFA) reads this list to populate
// a "when was the mapathon" dropdown instead of a free-typed field, so the
// hours credited match whatever the admin actually scheduled.
export async function mapathonDates(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  if (sub) { return byId(req, res, ctx, sub); }

  const { supabase } = ctx;

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('mapathon_dates').select(MAPATHON_DATE_COLUMNS).order('event_date', { ascending: false });
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'POST') {
    const eventDate = typeof req.body?.event_date === 'string' ? req.body.event_date : '';
    const hours = typeof req.body?.hours === 'number' ? req.body.hours : NaN;
    if (!eventDate) { badRequest(res, 'event_date is required'); return; }
    if (!Number.isFinite(hours) || hours <= 0) { badRequest(res, 'hours must be a positive number'); return; }

    const { data, error } = await supabase
      .from('mapathon_dates')
      .insert({
        event_date: eventDate,
        hours,
        label: req.body.label || null,
      })
      .select(MAPATHON_DATE_COLUMNS)
      .single();
    if (error) { throw error; }
    sendJson(res, 201, { data });
    return;
  }

  methodNotAllowed(res, ['GET', 'POST']);
}

async function byId(req: VercelRequest, res: VercelResponse, ctx: RequestContext, id: string) {
  const { supabase } = ctx;

  if (req.method === 'PATCH') {
    const updates: MapathonDateUpdate = {};
    for (const field of PATCHABLE_FIELDS) {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if ('event_date' in updates && !updates.event_date) { badRequest(res, 'event_date must be a non-empty string'); return; }
    if ('hours' in updates && (typeof updates.hours !== 'number' || updates.hours <= 0)) { badRequest(res, 'hours must be a positive number'); return; }
    if (Object.keys(updates).length === 0) { badRequest(res, 'No updatable fields provided'); return; }

    const { data, error } = await supabase.from('mapathon_dates').update(updates).eq('id', id).select(MAPATHON_DATE_COLUMNS).single();
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('mapathon_dates').delete().eq('id', id);
    if (error) { throw error; }
    sendJson(res, 204, null);
    return;
  }

  methodNotAllowed(res, ['PATCH', 'DELETE']);
}
