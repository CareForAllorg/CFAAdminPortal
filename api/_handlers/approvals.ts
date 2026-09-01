import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { methodNotAllowed, sendJson } from '../_lib/http.js';

export async function approvals(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  if (sub !== 'stats') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  const { supabase } = ctx;

  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const [approvedRes, pendingRes, verifTotalRes, verifIncompleteRes, mappingRes] = await Promise.all([
    supabase.from('service_logs').select('hours, primary_impact').eq('status', 'approved'),
    supabase.from('service_logs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('service_logs').select('*', { count: 'exact', head: true }).not('verify_method', 'is', null),
    supabase.from('service_logs').select('*', { count: 'exact', head: true }).not('verify_method', 'is', null).eq('verification_completed', false),
    supabase.from('profiles').select('mapping_hours'),
  ]);

  if (approvedRes.error) { throw approvedRes.error; }
  if (pendingRes.error) { throw pendingRes.error; }
  if (verifTotalRes.error) { throw verifTotalRes.error; }
  if (verifIncompleteRes.error) { throw verifIncompleteRes.error; }
  if (mappingRes.error) { throw mappingRes.error; }

  // Mapping submissions report a running total, not a session delta --
  // profiles.mapping_hours (replaced, not summed, on approval -- see
  // serviceLogs.ts) is the source of truth for a member's mapping hours,
  // so their tagged service_logs rows are excluded here to avoid counting
  // every resubmission on top of it.
  const totalHours = (approvedRes.data ?? [])
    .reduce((sum, r) => sum + (r.primary_impact === 'Buildings Mapped' ? 0 : Number(r.hours) || 0), 0)
    + (mappingRes.data ?? []).reduce((sum, p) => sum + (Number(p.mapping_hours) || 0), 0);

  sendJson(res, 200, {
    totalHours,
    pendingCount: pendingRes.count ?? 0,
    verifTotal: verifTotalRes.count ?? 0,
    verifIncomplete: verifIncompleteRes.count ?? 0,
  });
}
