import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { methodNotAllowed, sendJson } from '../_lib/http.js';
import { collectUserIds, fetchProfilesByUserId } from '../_lib/joinProfiles.js';

// Read-only: "how many mapathons are hosted" (chapters.status-style event
// records a chapter lead files after hosting one) -- see
// VolunteerPortalCFA's POST /api/mapping/mapathon-reports for where these
// come from. Distinct from mapathon *time log* submissions, which are
// pending service_logs handled by useMapathonSubmissions.ts /
// serviceLogs.ts instead.
export async function mapathonReports(req: VercelRequest, res: VercelResponse, ctx: RequestContext) {
  const { supabase } = ctx;

  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const { data: reports, error } = await supabase
    .from('mapathon_reports')
    .select('id, user_id, chapter_id, event_date, setting, participants, tasks_completed, notes, proof_path, created_at')
    .order('event_date', { ascending: false });
  if (error) { throw error; }

  const [profileById, chaptersRes] = await Promise.all([
    fetchProfilesByUserId(supabase, collectUserIds(reports ?? [])),
    supabase.from('chapters').select('id, name'),
  ]);
  if (chaptersRes.error) { throw chaptersRes.error; }

  const chapterNameById: Record<string, string> = {};
  (chaptersRes.data ?? []).forEach((c) => { chapterNameById[c.id] = c.name; });

  const data = (reports ?? []).map((r) => {
    const profile = r.user_id ? profileById[r.user_id] : null;
    const hostName = profile ? ((profile.first_name || '') + ' ' + (profile.last_name || '')).trim() || '-' : '-';
    return {
      id: r.id,
      hostName,
      chapterName: r.chapter_id ? (chapterNameById[r.chapter_id] ?? '-') : '-',
      eventDate: r.event_date,
      setting: r.setting,
      participants: r.participants,
      tasksCompleted: r.tasks_completed,
      notes: r.notes,
      proofPath: r.proof_path,
      createdAt: r.created_at,
    };
  });

  sendJson(res, 200, { data, total: data.length });
}
