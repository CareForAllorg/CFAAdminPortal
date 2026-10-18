import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { methodNotAllowed, sendJson } from '../_lib/http.js';
import { computeMentorStats } from '../_lib/mentorStats.js';

// A mentor is anyone whose profile has role = 'mentor' -- not whoever
// happens to have "mentor" in an activity name. Pulls every approved log
// those people submitted (pending/rejected aren't work done) and lets
// computeMentorStats bucket by activity type; logs that fit no bucket
// (e.g. a mentor's own mapping hours) come back under totals.other by
// name so a mislabelled office-hours type is visible rather than lost.
export async function mentorStats(req: VercelRequest, res: VercelResponse, ctx: RequestContext) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const { supabase } = ctx;

  const { data: mentorProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('role', 'mentor');
  if (profilesError) { throw profilesError; }

  const nameByUserId: Record<string, string> = {};
  (mentorProfiles ?? []).forEach((p) => {
    nameByUserId[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unnamed mentor';
  });

  const mentorIds = Object.keys(nameByUserId);
  if (mentorIds.length === 0) {
    sendJson(res, 200, computeMentorStats([], nameByUserId));
    return;
  }

  const { data, error } = await supabase
    .from('service_logs')
    .select('user_id, name, activity_type, hours, submitted_at, verification_details')
    .eq('status', 'approved')
    .in('user_id', mentorIds);
  if (error) { throw error; }

  sendJson(res, 200, computeMentorStats(data ?? [], nameByUserId));
}
