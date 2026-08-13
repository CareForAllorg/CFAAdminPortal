import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin, requireUser } from './_lib/auth.js';
import { sendError, sendJson } from './_lib/http.js';
import { chapters } from './_handlers/chapters.js';
import { profiles } from './_handlers/profiles.js';
import { serviceLogs } from './_handlers/serviceLogs.js';
import { chapterCheckins } from './_handlers/chapterCheckins.js';
import { checkinDeadlines } from './_handlers/checkinDeadlines.js';
import { mentors } from './_handlers/mentors.js';
import { resources } from './_handlers/resources.js';
import { mentorshipSessions } from './_handlers/mentorshipSessions.js';
import { overview } from './_handlers/overview.js';
import { leaderboard } from './_handlers/leaderboard.js';
import { impact } from './_handlers/impact.js';
import { approvals } from './_handlers/approvals.js';
import { mappingProjects } from './_handlers/mappingProjects.js';
import { mapathonReports } from './_handlers/mapathonReports.js';
import { uploadsSignedUrl, uploadMentorAvatar, uploadMapathonAttendance } from './_handlers/uploads.js';
import { partners } from './_handlers/partners.js';
import { formSubmissions } from './_handlers/formSubmissions.js';
import { mapathonDates } from './_handlers/mapathonDates.js';
import { mentorApplications, mentorApplicationsWebhook } from './_handlers/mentorApplications.js';

// Single entry point for the entire API. Every file directly under /api
// (one per resource/verb) counts as its own Vercel Serverless Function,
// and the Hobby plan caps a deployment at 12 -- this app has more
// resources than that once you split list/create from get/patch/delete.
//
// This used to be a bracket catch-all (api/[...route].ts), which turned
// out not to reliably match multi-segment paths in Vercel's plain (non-
// Next.js) function routing -- single-segment routes like
// /api/service-logs worked, but two-segment ones like
// /api/overview/stats 404'd. Instead, vercel.json explicitly rewrites
// every /api/:path* request to /api/handler?path=:path*, so the sub-path
// arrives as a plain, guaranteed-reliable query string rather than
// depending on bracket-route matching. URL shape is unchanged for the
// frontend -- /api/chapters/enriched still resolves the same way.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawPath = req.query.path;
  const pathString = Array.isArray(rawPath) ? rawPath.join('/') : rawPath ?? '';
  const segments = pathString.split('/').filter(Boolean);
  const [resource, sub] = segments;

  try {
    // profiles/me is the one route any signed-in Supabase user can hit --
    // the frontend needs it to find out whether the account is actually
    // admin before rendering (or being allowed to load) anything else.
    // Every other route requires an admin profiles.role.
    if (resource === 'profiles' && sub === 'me') {
      const ctx = await requireUser(req);
      return await profiles(req, res, ctx, sub);
    }

    // Called by a Google Apps Script trigger on the external "Become a
    // Mentor" form, not by a signed-in admin -- there's no Supabase
    // session to require here, only the handler's own shared-secret check.
    if (resource === 'mentor-applications' && sub === 'webhook') {
      return await mentorApplicationsWebhook(req, res);
    }

    const ctx = await requireAdmin(req);

    switch (resource) {
      case 'chapters': return await chapters(req, res, ctx, sub);
      case 'profiles': return await profiles(req, res, ctx, sub);
      case 'service-logs': return await serviceLogs(req, res, ctx, sub);
      case 'chapter-checkins': return await chapterCheckins(req, res, ctx, sub);
      case 'checkin-deadlines': return await checkinDeadlines(req, res, ctx);
      case 'mentors': return await mentors(req, res, ctx, sub);
      case 'resources': return await resources(req, res, ctx, sub);
      case 'mentorship-sessions': return await mentorshipSessions(req, res, ctx);
      case 'overview': return await overview(req, res, ctx, sub);
      case 'leaderboard': return await leaderboard(req, res, ctx, sub);
      case 'impact': return await impact(req, res, ctx, sub);
      case 'approvals': return await approvals(req, res, ctx, sub);
      case 'mapping-projects': return await mappingProjects(req, res, ctx, sub);
      case 'mapathon-reports': return await mapathonReports(req, res, ctx);
      case 'partners': return await partners(req, res, ctx, sub);
      case 'form-submissions': return await formSubmissions(req, res, ctx, sub);
      case 'mapathon-dates': return await mapathonDates(req, res, ctx, sub);
      case 'mentor-applications': return await mentorApplications(req, res, ctx, sub);
      case 'uploads':
        if (sub === 'signed-url') { return await uploadsSignedUrl(req, res, ctx); }
        if (sub === 'mentor-avatar') { return await uploadMentorAvatar(req, res, ctx); }
        if (sub === 'mapathon-attendance') { return await uploadMapathonAttendance(req, res, ctx); }
        sendJson(res, 404, { error: `Unknown route: /${segments.join('/')}` });
        return;
      default:
        sendJson(res, 404, { error: `Unknown route: /${segments.join('/')}` });
    }
  } catch (err) {
    sendError(res, err);
  }
}
