import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { methodNotAllowed, sendJson } from '../_lib/http.js';
import { MEMBER_ROLES } from '../../src/roles.js';

// Builds the event series the Impact Measurables page charts (member/
// chapter growth over time, plus one series per primary/secondary impact
// category logged on approved service_logs).
export async function impact(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  if (sub !== 'events') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  const { supabase } = ctx;

  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const [membersRes, chaptersRes, logsRes, mapathonsRes] = await Promise.all([
    supabase.from('profiles').select('created_at').in('role', MEMBER_ROLES),
    supabase.from('chapters').select('created_at'),
    supabase
      .from('service_logs')
      .select('user_id, primary_impact, impact_magnitude, secondary_impact, secondary_impact_magnitude, submitted_at')
      .eq('status', 'approved'),
    supabase.from('mapathon_dates').select('event_date, total_buildings_mapped, total_km_roads_mapped'),
  ]);

  if (membersRes.error) { throw membersRes.error; }
  if (chaptersRes.error) { throw chaptersRes.error; }
  if (logsRes.error) { throw logsRes.error; }
  if (mapathonsRes.error) { throw mapathonsRes.error; }

  const categories: Record<string, { date: string; magnitude: number }[]> = {};
  function addEvent(category: string | null, magnitude: number | null, date: string | null) {
    if (!category || !date) { return; }
    if (!categories[category]) { categories[category] = []; }
    categories[category].push({ date, magnitude: Number(magnitude) || 0 });
  }

  type LogRow = NonNullable<typeof logsRes.data>[number];
  const MAPPING_CATEGORIES = new Set(['Buildings Mapped', 'Roads Mapped']);
  function mappingValue(row: LogRow, category: string): number | null {
    if (row.primary_impact === category) { return row.impact_magnitude; }
    if (row.secondary_impact === category) { return row.secondary_impact_magnitude; }
    return null;
  }

  // Mapping submissions report the member's new running total, not a
  // delta (profiles.buildings_mapped/km_roads_mapped already get replaced
  // rather than summed on approval -- see serviceLogs.ts). Every other
  // approved log is a distinct event and adds normally, but for Buildings
  // Mapped/Roads Mapped only each member's single most recent approved
  // submission should count toward the org-wide total, or a member who
  // resubmits their total would get counted multiple times.
  const latestMappingRowByUser = new Map<string, LogRow>();
  (logsRes.data ?? []).forEach((row) => {
    const isMappingRow = MAPPING_CATEGORIES.has(row.primary_impact ?? '') || MAPPING_CATEGORIES.has(row.secondary_impact ?? '');
    if (!isMappingRow) { return; }

    if (!row.user_id) {
      // No linked profile to dedupe by -- fall back to counting it as its
      // own event rather than silently dropping it.
      MAPPING_CATEGORIES.forEach((category) => addEvent(category, mappingValue(row, category), row.submitted_at));
      return;
    }

    const existing = latestMappingRowByUser.get(row.user_id);
    if (!existing || new Date(row.submitted_at ?? 0) > new Date(existing.submitted_at ?? 0)) {
      latestMappingRowByUser.set(row.user_id, row);
    }
  });
  latestMappingRowByUser.forEach((row) => {
    MAPPING_CATEGORIES.forEach((category) => addEvent(category, mappingValue(row, category), row.submitted_at));
  });

  // Mapathon self-reported totals (see the publishing_stats migration) are
  // the org's own contribution, NOT member submissions -- they get added
  // on top of the replace-with-latest per-member total above, anchored at
  // the mapathon's event_date. Dates never published keep their 0
  // defaults, so they contribute nothing rather than being filtered out.
  type MapathonRow = NonNullable<typeof mapathonsRes.data>[number];
  (mapathonsRes.data ?? []).forEach((row: MapathonRow) => {
    if (Number(row.total_buildings_mapped) > 0) { addEvent('Buildings Mapped', row.total_buildings_mapped, row.event_date); }
    if (Number(row.total_km_roads_mapped) > 0) { addEvent('Roads Mapped', row.total_km_roads_mapped, row.event_date); }
  });

  (logsRes.data ?? []).forEach((row) => {
    if (row.primary_impact && !MAPPING_CATEGORIES.has(row.primary_impact)) { addEvent(row.primary_impact, row.impact_magnitude, row.submitted_at); }
    if (row.secondary_impact && !MAPPING_CATEGORIES.has(row.secondary_impact)) { addEvent(row.secondary_impact, row.secondary_impact_magnitude, row.submitted_at); }
  });

  sendJson(res, 200, {
    totalmembers: (membersRes.data ?? []).map((r) => ({ date: r.created_at, magnitude: 1 })),
    totalchapters: (chaptersRes.data ?? []).map((r) => ({ date: r.created_at, magnitude: 1 })),
    categories,
  });
}
