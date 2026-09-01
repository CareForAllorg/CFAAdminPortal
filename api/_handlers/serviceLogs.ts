import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import { firstQueryValue, parsePageParams } from '../_lib/pagination.js';
import { attachProfiles } from '../_lib/joinProfiles.js';

// service_logs.user_id has a real FK to `users`, not `profiles` (profiles
// happens to share the same id space via profiles.id -> users.id), so
// there's no FK PostgREST can use to embed `profiles:user_id(...)`
// directly here. See attachProfiles() -- it does the lookup as a second
// query and stitches the same `profiles` shape onto each row.
const LOG_COLUMNS = `
  id, user_id, name, org_name, activity_type, hours, status, description,
  submitted_at, reviewed_at, reviewed_by, verify_method, verification_completed,
  verification_completed_at, verification_details, primary_impact, impact_magnitude,
  secondary_impact, secondary_impact_magnitude, proof_path
`;

// Handles /api/service-logs (list/create) and /api/service-logs/:id
// (get/patch/delete). See collection() below for the filter query params
// every list/aggregate view needs.
export async function serviceLogs(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  if (sub) { return byId(req, res, ctx, sub); }
  return collection(req, res, ctx);
}

async function collection(req: VercelRequest, res: VercelResponse, ctx: RequestContext) {
  const { supabase } = ctx;

  if (req.method === 'GET') {
    let query = supabase.from('service_logs').select(LOG_COLUMNS, { count: 'exact' });

    const status = firstQueryValue(req, 'status');
    if (status) { query = query.eq('status', status as 'pending' | 'approved' | 'rejected'); }

    if (firstQueryValue(req, 'hasVerifyMethod') === 'true') {
      query = query.not('verify_method', 'is', null);
    }

    if (firstQueryValue(req, 'hasProof') === 'true') {
      query = query.not('proof_path', 'is', null);
    }

    const verificationCompleted = firstQueryValue(req, 'verificationCompleted');
    if (verificationCompleted === 'true' || verificationCompleted === 'false') {
      query = query.eq('verification_completed', verificationCompleted === 'true');
    }

    const activityTypeContains = firstQueryValue(req, 'activityTypeContains');
    if (activityTypeContains) { query = query.ilike('activity_type', `%${activityTypeContains}%`); }

    const activityTypeExcludes = firstQueryValue(req, 'activityTypeExcludes');
    if (activityTypeExcludes) { query = query.not('activity_type', 'ilike', `%${activityTypeExcludes}%`); }

    const submittedAfter = firstQueryValue(req, 'submittedAfter');
    if (submittedAfter) { query = query.gte('submitted_at', submittedAfter); }

    const submittedBefore = firstQueryValue(req, 'submittedBefore');
    if (submittedBefore) { query = query.lt('submitted_at', submittedBefore); }

    query = query.order('submitted_at', { ascending: false });

    const hasPaging = firstQueryValue(req, 'page') !== undefined;
    if (hasPaging) {
      const { from, to, page, limit } = parsePageParams(req);
      const { data, error, count } = await query.range(from, to);
      if (error) { throw error; }
      sendJson(res, 200, { data: await attachProfiles(supabase, data ?? []), page, limit, total: count ?? 0 });
      return;
    }

    const { data, error, count } = await query;
    if (error) { throw error; }
    sendJson(res, 200, { data: await attachProfiles(supabase, data ?? []), total: count ?? 0 });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    if (!body.activity_type || typeof body.hours !== 'number') {
      badRequest(res, 'activity_type and hours are required');
      return;
    }

    const { data, error } = await supabase
      .from('service_logs')
      .insert({
        user_id: body.user_id ?? null,
        name: body.name ?? null,
        org_name: body.org_name ?? null,
        activity_type: body.activity_type,
        hours: body.hours,
        description: body.description ?? null,
        verify_method: body.verify_method ?? null,
        primary_impact: body.primary_impact ?? null,
        impact_magnitude: body.impact_magnitude ?? null,
        secondary_impact: body.secondary_impact ?? null,
        secondary_impact_magnitude: body.secondary_impact_magnitude ?? null,
      })
      .select(LOG_COLUMNS)
      .single();
    if (error) { throw error; }
    const [withProfile] = await attachProfiles(supabase, [data]);
    sendJson(res, 201, { data: withProfile });
    return;
  }

  methodNotAllowed(res, ['GET', 'POST']);
}

// Only `status` and `verification_completed` are ever accepted here.
// reviewed_by/reviewed_at/verification_completed_at are set server-side by
// the service_logs_review_audit trigger (see
// supabase/migrations/20260706000003_service_log_review_audit_trigger.sql)
// from auth.uid()/now() -- a client can't spoof who reviewed a submission
// or when, because those fields are never read from the request body.
async function byId(req: VercelRequest, res: VercelResponse, ctx: RequestContext, id: string) {
  const { supabase } = ctx;

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('service_logs').select(LOG_COLUMNS).eq('id', id).single();
    if (error) { throw error; }
    const [withProfile] = await attachProfiles(supabase, [data]);
    sendJson(res, 200, { data: withProfile });
    return;
  }

  if (req.method === 'PATCH') {
    const updates: { status?: 'pending' | 'approved' | 'rejected'; verification_completed?: boolean } = {};

    if (req.body && 'status' in req.body) {
      if (!['pending', 'approved', 'rejected'].includes(req.body.status)) {
        badRequest(res, 'status must be pending, approved, or rejected');
        return;
      }
      updates.status = req.body.status;
    }

    if (req.body && 'verification_completed' in req.body) {
      if (typeof req.body.verification_completed !== 'boolean') {
        badRequest(res, 'verification_completed must be a boolean');
        return;
      }
      updates.verification_completed = req.body.verification_completed;
    }

    if (Object.keys(updates).length === 0) {
      badRequest(res, 'Provide status and/or verification_completed to update');
      return;
    }

    const { data, error } = await supabase.from('service_logs').update(updates).eq('id', id).select(LOG_COLUMNS).single();
    if (error) { throw error; }

    // Mapping submissions carry the member's new cumulative totals, not a
    // delta -- approving one must REPLACE profiles.buildings_mapped/
    // km_roads_mapped/mapping_hours, never add to them, per the
    // member-facing form's "must replace the last reported totals"
    // requirement. mapping_hours is kept out of the normal additive
    // service_logs.hours sum everywhere Total Hours is computed (see those
    // call sites) specifically so a resubmitted total doesn't inflate it.
    if (updates.status === 'approved' && data.user_id && data.primary_impact === 'Buildings Mapped') {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          buildings_mapped: data.impact_magnitude ?? 0,
          km_roads_mapped: data.secondary_impact_magnitude ?? 0,
          mapping_hours: data.hours ?? 0,
        })
        .eq('id', data.user_id);
      if (profileError) { throw profileError; }
    }

    const [withProfile] = await attachProfiles(supabase, [data]);
    sendJson(res, 200, { data: withProfile });
    return;
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('service_logs').delete().eq('id', id);
    if (error) { throw error; }
    sendJson(res, 204, null);
    return;
  }

  methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
}
