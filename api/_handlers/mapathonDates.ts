import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import type { Database } from '../../src/types/database.generated.js';
import { applyProfileDeltas, reverseMapathonCredits } from '../_lib/mapathonCredits.js';

const MAPATHON_DATE_COLUMNS = 'id, event_date, hours, label, created_at, total_buildings_mapped, total_km_roads_mapped, bonus_service_hours, attendance_list_path';

type MapathonDateUpdate = Database['public']['Tables']['mapathon_dates']['Update'];

const PATCHABLE_FIELDS = [
  'event_date', 'hours', 'label',
  'total_buildings_mapped', 'total_km_roads_mapped', 'bonus_service_hours', 'attendance_list_path',
] as const satisfies readonly (keyof MapathonDateUpdate)[];

// total_buildings_mapped/total_km_roads_mapped/bonus_service_hours are
// self-reported by the admin, not calculated from member submissions --
// zero is a valid, common value (e.g. a mapathon with no bonus hours), so
// these only get validated as non-negative, not required/positive like
// `hours` (the per-attendee credited amount, which must be > 0). Used by
// both verbs: POST validates then inserts them, PATCH validates before the
// .update() -- either one rejects a non-negative violation with a 400.
// Returns null for an absent value (leave the column alone) and NaN for an
// explicitly invalid one.
function nonNegativeNumber(value: unknown): number | null {
  if (value === undefined) { return null; }
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : NaN;
}

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

    const insert: Database['public']['Tables']['mapathon_dates']['Insert'] = {
      event_date: eventDate,
      hours,
      label: req.body.label || null,
    };
    for (const field of ['total_buildings_mapped', 'total_km_roads_mapped', 'bonus_service_hours'] as const) {
      const value = nonNegativeNumber(req.body?.[field]);
      if (value === null) { continue; }
      if (!Number.isFinite(value)) { badRequest(res, `${field} must be a non-negative number`); return; }
      insert[field] = value;
    }

    const { data, error } = await supabase
      .from('mapathon_dates')
      .insert(insert)
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
    for (const field of ['total_buildings_mapped', 'total_km_roads_mapped', 'bonus_service_hours'] as const) {
      if (field in updates) {
        const value = nonNegativeNumber(updates[field]);
        if (typeof value !== 'number' || !Number.isFinite(value)) { badRequest(res, `${field} must be a non-negative number`); return; }
        updates[field] = value;
      }
    }
    if (Object.keys(updates).length === 0) { badRequest(res, 'No updatable fields provided'); return; }

    const { data, error } = await supabase.from('mapathon_dates').update(updates).eq('id', id).select(MAPATHON_DATE_COLUMNS).single();
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'DELETE') {
    // Reverse whatever this date's attendance upload credited before
    // deleting it -- the FK is ON DELETE SET NULL (a record of the hours
    // having existed stays, just orphaned from this date), so without this
    // the deleted date's hours and buildings/roads share would stay
    // credited on every attendee's profile forever.
    const deltaByUser = await reverseMapathonCredits(supabase, id);
    await applyProfileDeltas(supabase, deltaByUser);

    const { error } = await supabase.from('mapathon_dates').delete().eq('id', id);
    if (error) { throw error; }
    sendJson(res, 204, null);
    return;
  }

  methodNotAllowed(res, ['PATCH', 'DELETE']);
}
