import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { methodNotAllowed, sendJson } from '../_lib/http.js';
import { MEMBER_ROLES } from '../../src/roles.js';
import { computeChapterCompliance } from '../_lib/compliance.js';

export async function overview(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  if (sub !== 'stats') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  const { supabase } = ctx;

  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const { count: chapterCount, error: chapterErr } = await supabase
    .from('chapters')
    .select('*', { count: 'exact', head: true });
  if (chapterErr) { throw chapterErr; }

  const { count: memberCount, error: memberErr } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .in('role', MEMBER_ROLES);
  if (memberErr) { throw memberErr; }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: newMemberCount, error: newMemberErr } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .in('role', MEMBER_ROLES)
    .gte('created_at', thirtyDaysAgo);
  if (newMemberErr) { throw newMemberErr; }

  // Same derivation the Chapters page's compliance table uses, so the
  // Overview's "non-compliant" sub doesn't drift from it (or go stale the
  // way the old hardcoded "7 non-compliant" string did).
  const { enriched } = await computeChapterCompliance(req, ctx);
  const nonCompliantCount = enriched.filter((c) => !c.compliant).length;

  sendJson(res, 200, {
    chapterCount: chapterCount ?? 0,
    memberCount: memberCount ?? 0,
    newMemberCount: newMemberCount ?? 0,
    nonCompliantCount,
  });
}
