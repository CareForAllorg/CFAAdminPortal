import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { methodNotAllowed, sendJson } from '../_lib/http.js';
import { firstQueryValue, parsePageParams } from '../_lib/pagination.js';
import type { Database } from '../../src/types/database.generated.js';

const PROFILE_COLUMNS = 'id, first_name, last_name, role, gender, education_level, date_of_birth, location, chapter_id, created_at, chapters:chapter_id ( name )';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

const PATCHABLE_FIELDS = ['first_name', 'last_name', 'role', 'gender', 'education_level', 'date_of_birth', 'chapter_id', 'calendly_url'] as const satisfies readonly (keyof ProfileUpdate)[];

// Handles /api/profiles (list, with role/q/page/limit filters),
// /api/profiles/:id, and /api/profiles/me.
export async function profiles(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  if (sub === 'me') { return me(req, res, ctx); }
  if (sub) { return byId(req, res, ctx, sub); }

  const { supabase } = ctx;

  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  let query = supabase.from('profiles').select(PROFILE_COLUMNS, { count: 'exact' });

  const role = firstQueryValue(req, 'role');
  if (role) {
    query = query.in('role', role.split(',').map((r) => r.trim()).filter(Boolean));
  }

  const q = firstQueryValue(req, 'q')?.trim();
  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
  }

  const createdAfter = firstQueryValue(req, 'createdAfter');
  if (createdAfter) {
    query = query.gte('created_at', createdAfter);
  }

  const hasPaging = firstQueryValue(req, 'page') !== undefined;
  if (hasPaging) {
    const { from, to, page, limit } = parsePageParams(req);
    const { data, error, count } = await query.order('first_name').range(from, to);
    if (error) { throw error; }
    sendJson(res, 200, { data, page, limit, total: count ?? 0 });
    return;
  }

  const { data, error, count } = await query.order('first_name');
  if (error) { throw error; }
  sendJson(res, 200, { data, total: count ?? 0 });
}

async function byId(req: VercelRequest, res: VercelResponse, ctx: RequestContext, id: string) {
  const { supabase } = ctx;

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).single();
    if (error) { throw error; }

    // email lives on public.users, not profiles -- profiles.id references
    // users.id (a shared-PK relationship), so this is a second lookup by
    // id rather than an untested PostgREST embed across that FK.
    const { data: userRow, error: userError } = await supabase.from('users').select('email').eq('id', id).maybeSingle();
    if (userError) { throw userError; }

    sendJson(res, 200, { data: { ...data, email: userRow?.email ?? null } });
    return;
  }

  if (req.method === 'PATCH') {
    const updates: ProfileUpdate = {};
    for (const field of PATCHABLE_FIELDS) {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select(PROFILE_COLUMNS).single();
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  methodNotAllowed(res, ['GET', 'PATCH']);
}

// The signed-in admin's own profile (name/role for the sidebar/topbar) --
// scoped to req's own user, so the frontend never has to know its own
// profile id up front.
async function me(req: VercelRequest, res: VercelResponse, ctx: RequestContext) {
  const { supabase, user } = ctx;

  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single();
  if (error) { throw error; }
  sendJson(res, 200, { data });
}
