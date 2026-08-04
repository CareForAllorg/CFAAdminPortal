import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import { firstQueryValue } from '../_lib/pagination.js';
import { collectUserIds, fetchProfilesByUserId } from '../_lib/joinProfiles.js';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
type Quarter = (typeof QUARTERS)[number];
type QuarterStatus = 'done' | 'overdue' | 'pending';

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
    sendJson(res, 200, { data });
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
// 4 quarterly check-ins) are unchanged -- still a computed view, not a
// real `chapters_enriched` table.
async function enriched(req: VercelRequest, res: VercelResponse, ctx: RequestContext) {
  const { supabase } = ctx;

  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const yearParam = firstQueryValue(req, 'year');
  const currentYear = yearParam ? Number(yearParam) : new Date().getFullYear();

  const [chaptersRes, profilesRes, checkinsRes, projectLogsRes, deadlinesRes] = await Promise.all([
    supabase.from('chapters').select('id, name, created_at, project_count_override').order('name'),
    supabase.from('profiles').select('id, first_name, last_name, chapter_id, role'),
    supabase.from('chapter_checkins').select('id, chapter_name, quarter, activities, member_count, challenges, submitted_at').order('submitted_at', { ascending: false }),
    supabase.from('service_logs').select('user_id, activity_type').eq('status', 'approved').ilike('activity_type', '%project%'),
    supabase.from('checkin_deadlines').select('year, q1, q2, q3, q4').eq('year', currentYear).maybeSingle(),
  ]);

  if (chaptersRes.error) { throw chaptersRes.error; }
  if (profilesRes.error) { throw profilesRes.error; }
  if (checkinsRes.error) { throw checkinsRes.error; }
  if (projectLogsRes.error) { throw projectLogsRes.error; }
  if (deadlinesRes.error) { throw deadlinesRes.error; }

  const chaptersData = chaptersRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const checkins = checkinsRes.data ?? [];
  const projectLogs = projectLogsRes.data ?? [];
  const deadlines: { q1?: string | null; q2?: string | null; q3?: string | null; q4?: string | null } = deadlinesRes.data ?? {};

  const memberCountByChapterId: Record<string, number> = {};
  const leadByChapterId: Record<string, string> = {};
  profiles.forEach((p) => {
    if (!p.chapter_id) { return; }
    memberCountByChapterId[p.chapter_id] = (memberCountByChapterId[p.chapter_id] || 0) + 1;
    if (p.role === 'chapter_lead' && !leadByChapterId[p.chapter_id]) {
      leadByChapterId[p.chapter_id] = ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || '-';
    }
  });

  // service_logs.user_id has no direct FK to profiles (see
  // api/_lib/joinProfiles.ts), so this is a second lookup rather than a
  // PostgREST embed.
  const projectProfileById = await fetchProfilesByUserId(supabase, collectUserIds(projectLogs));
  const projectCountByChapterId: Record<string, number> = {};
  projectLogs.forEach((log) => {
    const chapterId = log.user_id ? projectProfileById[log.user_id]?.chapter_id : null;
    if (chapterId) { projectCountByChapterId[chapterId] = (projectCountByChapterId[chapterId] || 0) + 1; }
  });

  const dueDateByQuarter: Record<Quarter, string | null | undefined> = {
    Q1: deadlines.q1, Q2: deadlines.q2, Q3: deadlines.q3, Q4: deadlines.q4,
  };

  const checkinsByChapterName: Record<string, typeof checkins> = {};
  checkins.forEach((c) => {
    const key = (c.chapter_name || '').trim();
    if (!checkinsByChapterName[key]) { checkinsByChapterName[key] = []; }
    checkinsByChapterName[key].push(c);
  });

  const today = new Date();

  const enrichedChapters = chaptersData.map((ch) => {
    const chapterCheckins = checkinsByChapterName[ch.name] || [];

    const quarterStatuses: QuarterStatus[] = QUARTERS.map((q) => {
      const submitted = chapterCheckins.find(
        (c) => c.quarter === q && !!c.submitted_at && new Date(c.submitted_at).getFullYear() === currentYear
      );
      if (submitted) { return 'done'; }

      const dueDate = dueDateByQuarter[q];
      if (dueDate && new Date(dueDate) < today) { return 'overdue'; }
      return 'pending';
    });

    const allCheckinsIn = quarterStatuses.every((s) => s === 'done');
    const derivedProjectCount = projectCountByChapterId[ch.id] || 0;
    const projectCount = ch.project_count_override ?? derivedProjectCount;

    return {
      id: ch.id,
      name: ch.name,
      createdAt: ch.created_at,
      lead: leadByChapterId[ch.id] || '-',
      memberCount: memberCountByChapterId[ch.id] || 0,
      projectCount,
      projectCountOverride: ch.project_count_override,
      quarterStatuses,
      checkins: chapterCheckins,
      compliant: projectCount >= 2 && allCheckinsIn,
    };
  });

  sendJson(res, 200, { enriched: enrichedChapters, deadlines, currentYear });
}
