import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import { firstQueryValue } from '../_lib/pagination.js';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/;

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

  const path = firstQueryValue(req, 'path');
  if (!path) { badRequest(res, 'path is required'); return; }

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
