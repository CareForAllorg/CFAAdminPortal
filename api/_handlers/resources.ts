import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import type { Database } from '../../src/types/database.generated.js';

const RESOURCE_COLUMNS = 'id, category, title, description, link, source_type, duration, audience, status, featured, video_role, sort_order, updated_at';

type ResourceUpdate = Database['public']['Tables']['resources']['Update'];

const PATCHABLE_FIELDS = ['title', 'description', 'link', 'status', 'category', 'source_type', 'duration', 'audience', 'featured', 'video_role', 'sort_order'] as const satisfies readonly (keyof ResourceUpdate)[];

// Handles /api/resources (list/create) and /api/resources/:id (patch).
// One PATCH endpoint serves Edit (title/description/link), Hide
// ({status: 'coming-soon'}), and Publish ({status: 'published'}) --
// same flexible partial-update pattern as api/_handlers/mentors.ts.
export async function resources(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  if (sub === 'reorder') { return reorder(req, res, ctx); }
  if (sub) { return byId(req, res, ctx, sub); }

  const { supabase } = ctx;

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('resources').select(RESOURCE_COLUMNS).order('category').order('sort_order');
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'POST') {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) { badRequest(res, 'title is required'); return; }

    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
    if (!category) { badRequest(res, 'category is required'); return; }

    const status = req.body?.status === 'coming-soon' ? 'coming-soon' : 'published';

    // New resources land at the end of their category's order rather than
    // defaulting to 0 (which would jump them to the front, ahead of
    // whatever order an admin already set up).
    const { data: existing, error: maxError } = await supabase
      .from('resources')
      .select('sort_order')
      .eq('category', category)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) { throw maxError; }
    const nextSortOrder = (existing?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from('resources')
      .insert({
        title,
        category,
        description: req.body.description ?? null,
        link: req.body.link ?? null,
        source_type: req.body.source_type ?? null,
        duration: req.body.duration ?? null,
        audience: req.body.audience ?? null,
        status,
        featured: req.body.featured === true,
        video_role: req.body.video_role ?? null,
        sort_order: nextSortOrder,
      })
      .select(RESOURCE_COLUMNS)
      .single();
    if (error) { throw error; }
    sendJson(res, 201, { data });
    return;
  }

  methodNotAllowed(res, ['GET', 'POST']);
}

// Drag-and-drop reordering within one category sends the whole new order
// at once rather than one PATCH per moved row -- a drop can shift several
// rows' positions simultaneously (everything between the old and new
// slot), and reassigning 0..n-1 across the full dropped order is simpler
// and less error-prone than computing which individual rows moved.
async function reorder(req: VercelRequest, res: VercelResponse, ctx: RequestContext) {
  const { supabase } = ctx;

  if (req.method !== 'PATCH') {
    methodNotAllowed(res, ['PATCH']);
    return;
  }

  const orderedIds = req.body?.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string') || orderedIds.length === 0) {
    badRequest(res, 'orderedIds must be a non-empty array of resource ids');
    return;
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('resources').update({ sort_order: i }).eq('id', orderedIds[i]);
    if (error) { throw error; }
  }

  sendJson(res, 200, { success: true });
}

async function byId(req: VercelRequest, res: VercelResponse, ctx: RequestContext, id: string) {
  const { supabase } = ctx;

  if (req.method === 'PATCH') {
    const updates: ResourceUpdate = {};
    for (const field of PATCHABLE_FIELDS) {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if ('status' in updates && updates.status !== 'published' && updates.status !== 'coming-soon') {
      badRequest(res, 'status must be "published" or "coming-soon"');
      return;
    }

    if (Object.keys(updates).length === 0) { badRequest(res, 'No updatable fields provided'); return; }

    const { data, error } = await supabase.from('resources').update(updates).eq('id', id).select(RESOURCE_COLUMNS).single();
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('resources').delete().eq('id', id);
    if (error) { throw error; }
    sendJson(res, 204, null);
    return;
  }

  methodNotAllowed(res, ['PATCH', 'DELETE']);
}
