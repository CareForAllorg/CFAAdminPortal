import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import { firstQueryValue } from '../_lib/pagination.js';
import { parseCsv, validateAttendanceCsv } from '../_lib/parseAttendance.js';
import { applyProfileDeltas, reverseMapathonCredits } from '../_lib/mapathonCredits.js';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_ATTENDANCE_BYTES = 5 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/;
const ATTENDANCE_DATA_URL_PATTERN = /^data:(text\/csv|application\/csv);base64,(.+)$/;

// Generates a short-lived signed URL for a proof photo in the
// member-facing app's private `proof-uploads` Storage bucket (mapping
// time logs, mapathon reports). Uses ctx.supabase -- the caller's own
// session, not a service-role client -- so this only works once a
// Storage RLS policy exists granting admins read access to that bucket's
// objects; without one, createSignedUrl fails the same way any other
// admin write failed before its RLS policy existed.
export async function uploadsSignedUrl(req: VercelRequest, res: VercelResponse, ctx: RequestContext) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  // Named filePath, not path -- every request already gets rewritten to
  // /api/handler?path=<route-segments> (see handler.ts), so a caller-
  // supplied ?path=... here collides with and overwrites that, breaking
  // routing entirely instead of just failing to find this storage path.
  const path = firstQueryValue(req, 'filePath');
  if (!path) { badRequest(res, 'filePath is required'); return; }

  const { data, error } = await ctx.supabase.storage.from('proof-uploads').createSignedUrl(path, 300);
  if (error) { throw error; }

  sendJson(res, 200, { url: data.signedUrl });
}

// Uploads a mentor's profile picture to the public `mentor-avatars`
// bucket (see 20260812000000_mentor_avatars.sql) and writes the resulting
// public URL onto profiles.avatar_url -- that's what the member-facing
// app reads, the same as its name and Calendly link, so the photo needs
// to land there rather than on the admin-only mentors table.
export async function uploadMentorAvatar(req: VercelRequest, res: VercelResponse, ctx: RequestContext) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  const profileId = typeof req.body?.profileId === 'string' ? req.body.profileId.trim() : '';
  const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
  if (!profileId) { badRequest(res, 'profileId is required'); return; }

  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) { badRequest(res, 'dataUrl must be a base64-encoded png/jpeg/webp/gif image'); return; }

  const [, contentType, base64] = match;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.byteLength > MAX_AVATAR_BYTES) { badRequest(res, 'Image must be 2MB or smaller'); return; }

  const ext = contentType.split('/')[1];
  const path = `${profileId}/avatar.${ext}`;

  const { error: uploadError } = await ctx.supabase.storage
    .from('mentor-avatars')
    .upload(path, buffer, { contentType, upsert: true });
  if (uploadError) { throw uploadError; }

  const { data: publicUrlData } = ctx.supabase.storage.from('mentor-avatars').getPublicUrl(path);
  // Cache-bust: upsert overwrites the same path, so without a
  // query param every re-upload would keep resolving to a stale
  // browser-cached image at the same URL.
  const url = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: profileError } = await ctx.supabase.from('profiles').update({ avatar_url: url }).eq('id', profileId);
  if (profileError) { throw profileError; }

  sendJson(res, 200, { url });
}

// Uploads an attendance list (name/email CSV) for a mapathon to the private
// `mapathon-attendance` Storage bucket -- the admin picks a file in the
// publishing form, this stores it, and PR 9's form then PATCHes the
// returned path onto mapathon_dates.attendance_list_path. Reads go through
// a signed URL (see the "Admins can read mapathon attendance" policy), so
// the attendee names/emails never land in a public bucket. dateId is
// optional so a re-upload replaces the same `${dateId}/attendance.csv`
// path instead of stacking stale copies.
//
// Also credits each matched attendee's own service hours directly (see the
// mapathon_date_id column) -- the CSV is the org's own verification, so
// these land as 'approved' immediately rather than sitting in the normal
// pending-review queue.
export async function uploadMapathonAttendance(req: VercelRequest, res: VercelResponse, ctx: RequestContext) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  const dateId = typeof req.body?.dateId === 'string' && req.body.dateId.trim() !== '' ? req.body.dateId.trim() : undefined;
  const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
  const match = ATTENDANCE_DATA_URL_PATTERN.exec(dataUrl);
  if (!match) { badRequest(res, 'dataUrl must be a base64-encoded text/csv or application/csv file'); return; }

  const [, contentType, base64] = match;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.byteLength === 0) { badRequest(res, 'CSV file must not be empty'); return; }
  if (buffer.byteLength > MAX_ATTENDANCE_BYTES) { badRequest(res, 'CSV file must be 5MB or smaller'); return; }

  const validation = validateAttendanceCsv(buffer.toString('utf8'));
  if (!validation.ok) { badRequest(res, validation.reason); return; }

  const path = `${dateId ?? Date.now()}/attendance.csv`;

  const { error: uploadError } = await ctx.supabase.storage
    .from('mapathon-attendance')
    .upload(path, buffer, { contentType, upsert: true });
  if (uploadError) { throw uploadError; }

  // Credit each listed attendee's own service hours (and their even share
  // of the date's buildings/roads totals) directly -- previously this
  // upload only stored the file as proof and fed the mapathon's aggregate
  // totals into Impact Measurables; no individual member ever actually got
  // hours or a buildings/roads count credited from being on the list, only
  // from separately self-submitting through their own portal.
  let matchedCount = 0;
  let unmatchedCount = 0;
  if (dateId) {
    const { data: mapathonDate, error: dateError } = await ctx.supabase
      .from('mapathon_dates')
      .select('hours, event_date, label, total_buildings_mapped, total_km_roads_mapped')
      .eq('id', dateId)
      .maybeSingle();
    if (dateError) { throw dateError; }

    if (mapathonDate) {
      const rows = parseCsv(buffer.toString('utf8'));
      const [header, ...dataRows] = rows;
      const emailCol = header.findIndex((h) => h.trim().toLowerCase() === 'email');

      if (emailCol !== -1) {
        const csvEmails = dataRows
          .map((r) => (r[emailCol] ?? '').trim())
          .filter((e) => e.length > 0);

        // Case-insensitive match against every user rather than one .in()
        // call per email -- users.email isn't stored consistently
        // lowercased, and a large attendance list would otherwise risk the
        // same silent large-.in()-call failure hit elsewhere in this repo.
        const { data: allUsers, error: usersError } = await ctx.supabase.from('users').select('id, name, email');
        if (usersError) { throw usersError; }
        const byLowerEmail = new Map((allUsers ?? []).filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u]));

        const matched = csvEmails
          .map((e) => byLowerEmail.get(e.toLowerCase()))
          .filter((u): u is NonNullable<typeof u> => !!u);
        matchedCount = matched.length;
        unmatchedCount = csvEmails.length - matchedCount;

        // No per-attendee breakdown exists, only the date's own aggregate
        // totals -- split evenly across everyone credited from this list.
        const buildingsShare = matched.length > 0 ? Number(mapathonDate.total_buildings_mapped) / matched.length : 0;
        const kmShare = matched.length > 0 ? Number(mapathonDate.total_km_roads_mapped) / matched.length : 0;

        // Reverse whatever this date previously credited (if anything)
        // before replacing it, so a re-upload's net effect on each
        // member's profile totals is correct instead of double-crediting
        // them.
        const netDeltaByUser = await reverseMapathonCredits(ctx.supabase, dateId);
        for (const u of matched) {
          const d = netDeltaByUser.get(u.id) ?? { buildings: 0, km: 0 };
          d.buildings += buildingsShare;
          d.km += kmShare;
          netDeltaByUser.set(u.id, d);
        }

        if (matched.length > 0) {
          const description = `Mapathon attendance${mapathonDate.label ? `: ${mapathonDate.label}` : ''}`;
          const { error: insertError } = await ctx.supabase.from('service_logs').insert(
            matched.map((u) => ({
              user_id: u.id,
              name: u.name,
              email: u.email,
              activity_type: 'Mapathon',
              hours: mapathonDate.hours,
              status: 'approved' as const,
              description,
              submitted_at: mapathonDate.event_date,
              mapathon_date_id: dateId,
              primary_impact: buildingsShare > 0 ? 'Buildings Mapped' : null,
              impact_magnitude: buildingsShare > 0 ? buildingsShare : null,
              secondary_impact: kmShare > 0 ? 'Roads Mapped' : null,
              secondary_impact_magnitude: kmShare > 0 ? kmShare : null,
            }))
          );
          if (insertError) { throw insertError; }
        }

        // Additive across mapathons over time, not a replace (which is
        // only correct for the self-submission flow's "here's my current
        // running total" semantics, not an event-based credit).
        await applyProfileDeltas(ctx.supabase, netDeltaByUser);
      }
    }
  }

  sendJson(res, 200, { path, attendeeCount: validation.attendeeCount, matchedCount, unmatchedCount });
}
