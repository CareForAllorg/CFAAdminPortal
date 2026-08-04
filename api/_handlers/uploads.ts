import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import { firstQueryValue } from '../_lib/pagination.js';

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
