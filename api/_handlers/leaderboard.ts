import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { methodNotAllowed, sendJson } from '../_lib/http.js';
import { collectUserIds, fetchProfilesByUserId } from '../_lib/joinProfiles.js';

interface IndividualRow {
  name: string;
  chapter: string;
  hours: number;
  // null for name-only fallback entries with no linked profile (e.g.
  // mentor office-hours logged without one) -- nothing to open a member
  // profile for in that case.
  userId: string | null;
}

interface ChapterRow {
  id: string;
  name: string;
  type: 'Chapter' | 'Partner';
  hours: number;
}

export async function leaderboard(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  if (sub === 'individuals') { return individuals(res, ctx); }
  if (sub === 'chapters') { return chapters(res, ctx); }

  sendJson(res, 404, { error: 'Not found' });
}

// Ranks members (and unattributed name-only entries, e.g. mentor
// office-hours logged without a linked profile) by total approved hours.
// service_logs.user_id has no direct FK to profiles (see
// api/_lib/joinProfiles.ts), so the profile lookup is a second query
// rather than a PostgREST embed.
async function individuals(res: VercelResponse, ctx: RequestContext) {
  const { supabase } = ctx;

  const { data: logs, error } = await supabase
    .from('service_logs')
    .select('hours, user_id, name')
    .eq('status', 'approved');
  if (error) { throw error; }

  const rows = logs ?? [];
  const profileById = await fetchProfilesByUserId(supabase, collectUserIds(rows));

  const totals: Record<string, IndividualRow> = {};
  rows.forEach((row) => {
    let key: string;
    let displayName: string;
    let chapter: string;
    let userId: string | null;

    const profile = row.user_id ? profileById[row.user_id] : undefined;
    if (row.user_id && profile) {
      key = row.user_id;
      displayName = ((profile.first_name || '') + ' ' + (profile.last_name || '')).trim();
      chapter = profile.chapters?.name || (profile.role === 'mentor' ? 'Mentor' : '-');
      userId = row.user_id;
    } else if (row.name) {
      key = 'name:' + row.name.toLowerCase();
      displayName = row.name;
      chapter = '-';
      userId = null;
    } else {
      return;
    }

    if (!totals[key]) { totals[key] = { name: displayName, chapter, hours: 0, userId }; }
    totals[key].hours += Number(row.hours) || 0;
  });

  sendJson(res, 200, { data: Object.values(totals).sort((a, b) => b.hours - a.hours) });
}

// Master list of every chapter and partner -- including ones with 0 hours
// logged, per the requirements ("ALL CHAPTERS, and PARTNERS should be
// displayed on the board even if they have 0 hours"). Previously only
// chapters that happened to have approved service_logs showed up at all,
// and partners were a single hardcoded fake row.
async function chapters(res: VercelResponse, ctx: RequestContext) {
  const { supabase } = ctx;

  const [chaptersRes, partnersRes, logsRes] = await Promise.all([
    supabase.from('chapters').select('id, name'),
    supabase.from('partners').select('id, name'),
    supabase.from('service_logs').select('hours, user_id, org_name').eq('status', 'approved'),
  ]);
  if (chaptersRes.error) { throw chaptersRes.error; }
  if (partnersRes.error) { throw partnersRes.error; }
  if (logsRes.error) { throw logsRes.error; }

  const logs = logsRes.data ?? [];
  const profileById = await fetchProfilesByUserId(supabase, collectUserIds(logs));

  const hoursByChapterName: Record<string, number> = {};
  const hoursByOrgNameLower: Record<string, number> = {};
  logs.forEach((row) => {
    const hours = Number(row.hours) || 0;
    const chapterName = row.user_id ? profileById[row.user_id]?.chapters?.name : undefined;
    if (chapterName) { hoursByChapterName[chapterName] = (hoursByChapterName[chapterName] || 0) + hours; }

    // Partners have no FK on service_logs -- org_name is free text a
    // member types in, matched against a partner's name case-insensitively
    // as the closest real signal available, rather than always showing 0.
    if (row.org_name) {
      const key = row.org_name.trim().toLowerCase();
      hoursByOrgNameLower[key] = (hoursByOrgNameLower[key] || 0) + hours;
    }
  });

  const chapterRows: ChapterRow[] = (chaptersRes.data ?? []).map((c) => ({
    id: c.id, name: c.name, type: 'Chapter', hours: hoursByChapterName[c.name] || 0,
  }));
  const partnerRows: ChapterRow[] = (partnersRes.data ?? []).map((p) => ({
    id: p.id, name: p.name, type: 'Partner', hours: hoursByOrgNameLower[p.name.trim().toLowerCase()] || 0,
  }));

  sendJson(res, 200, { data: chapterRows.concat(partnerRows).sort((a, b) => b.hours - a.hours) });
}
