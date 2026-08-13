import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import { computeChapterCompliance } from '../_lib/compliance.js';

// Handles /api/chapters (collection), /api/chapters/:id, and
// /api/chapters/enriched -- merged into one module (see api/[...route].ts)
// so Vercel only counts one Function for the whole API instead of one per
// resource/verb, which is what blew past the Hobby plan's 12-function cap.
export async function chapters(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  const { supabase } = ctx;

  if (sub === 'enriched') { return enriched(req, res, ctx); }
  if (sub) { return byId(req, res, ctx, sub); }

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('chapters').select('id, name, created_at, status, meta').order('name');
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'POST') {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) { badRequest(res, 'name is required'); return; }

    const { data, error } = await supabase.from('chapters').insert({ name }).select().single();
    if (error) { throw error; }
    sendJson(res, 201, { data });
    return;
  }

  methodNotAllowed(res, ['GET', 'POST']);
}

async function byId(req: VercelRequest, res: VercelResponse, ctx: RequestContext, id: string) {
  const { supabase } = ctx;

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('chapters').select('id, name, created_at, status, meta').eq('id', id).single();
    if (error) { throw error; }

    // Multiple chapter_leads on one chapter_id is possible in principle
    // (though the member-facing app currently only ever promotes the
    // original applicant) -- reported as a list so co-leads each get their
    // own name/email rather than collapsing into one string.
    const { data: leadProfiles, error: leadsError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('chapter_id', id)
      .eq('role', 'chapter_lead');
    if (leadsError) { throw leadsError; }

    const { data: memberProfiles, error: memberError } = await supabase
      .from('profiles')
      .select('id')
      .eq('chapter_id', id);
    if (memberError) { throw memberError; }

    const leadIds = (leadProfiles ?? []).map((p) => p.id);
    const { data: leadUsers, error: usersError } = leadIds.length
      ? await supabase.from('users').select('id, email').in('id', leadIds)
      : { data: [] as { id: string; email: string | null }[], error: null };
    if (usersError) { throw usersError; }

    const emailById: Record<string, string | null> = {};
    (leadUsers ?? []).forEach((u) => { emailById[u.id] = u.email; });

    const leads = (leadProfiles ?? []).map((p) => ({
      name: ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || '-',
      email: emailById[p.id] ?? null,
    }));

    sendJson(res, 200, { data: { ...data, leads, memberCount: (memberProfiles ?? []).length } });
    return;
  }

  if (req.method === 'PATCH') {
    const updates: { name?: string; project_count_override?: number | null; status?: string } = {};

    if (req.body?.name !== undefined) {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!name) { badRequest(res, 'name must be a non-empty string'); return; }
      updates.name = name;
    }

    if (req.body?.project_count_override !== undefined) {
      const override = req.body.project_count_override;
      if (override !== null && (typeof override !== 'number' || !Number.isFinite(override) || override < 0)) {
        badRequest(res, 'project_count_override must be a non-negative number or null');
        return;
      }
      updates.project_count_override = override;
    }

    if (req.body?.status !== undefined) {
      const status = req.body.status;
      if (status !== 'active' && status !== 'pending' && status !== 'rejected') {
        badRequest(res, "status must be one of 'active', 'pending', 'rejected'");
        return;
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) { badRequest(res, 'name, project_count_override, or status is required'); return; }

    const { data, error } = await supabase.from('chapters').update(updates).eq('id', id).select().single();
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('chapters').delete().eq('id', id);
    if (error) { throw error; }
    sendJson(res, 204, null);
    return;
  }

  methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
}

// GET /api/chapters/enriched?year=2026
// Ported as-is from the old useChapterData.ts client hook: joins chapters,
// profiles, chapter_checkins, and approved "project" service_logs into a
// per-chapter compliance view. The derivation rules (2+ projects/year, all
// 4 quarterly check-ins) live in api/_lib/compliance.ts so the Admin
// Overview's non-compliant count uses the exact same rules. Still a
// computed view, not a real `chapters_enriched` table.
async function enriched(req: VercelRequest, res: VercelResponse, ctx: RequestContext) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  sendJson(res, 200, await computeChapterCompliance(req, ctx));
}
