import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import type { Database } from '../../src/types/database.generated.js';

const PROJECT_COLUMNS = 'id, region, country, types, url, color, description, mapping_level, featured, sort_order, created_at';

type ProjectUpdate = Database['public']['Tables']['mapping_projects']['Update'];

const PATCHABLE_FIELDS = [
  'region', 'country', 'types', 'url', 'color', 'description', 'mapping_level', 'featured', 'sort_order',
] as const satisfies readonly (keyof ProjectUpdate)[];

// Handles /api/mapping-projects (list/create) and /api/mapping-projects/:id
// (patch). Drives the "Mapping Project Directory" section on the Resources
// page, which used to be a hardcoded mock with no working buttons -- this
// table is the same one VolunteerPortalCFA's Mapping page now reads from
// (GET /api/mapping/projects there), so edits here take effect live for
// members without a deploy.
export async function mappingProjects(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  if (sub) { return byId(req, res, ctx, sub); }

  const { supabase } = ctx;

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('mapping_projects').select(PROJECT_COLUMNS).order('sort_order');
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'POST') {
    const region = typeof req.body?.region === 'string' ? req.body.region.trim() : '';
    const country = typeof req.body?.country === 'string' ? req.body.country.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    if (!region) { badRequest(res, 'region is required'); return; }
    if (!country) { badRequest(res, 'country is required'); return; }
    if (!description) { badRequest(res, 'description is required'); return; }

    // New tasks land at the end of the directory by default.
    const { data: maxRow } = await supabase
      .from('mapping_projects')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from('mapping_projects')
      .insert({
        region,
        country,
        description,
        types: Array.isArray(req.body?.types) ? req.body.types : [],
        url: req.body?.url || null,
        color: typeof req.body?.color === 'string' && req.body.color ? req.body.color : '#245EC2',
        mapping_level: req.body?.mapping_level || null,
        featured: true,
        sort_order: nextSortOrder,
      })
      .select(PROJECT_COLUMNS)
      .single();
    if (error) { throw error; }
    sendJson(res, 201, { data });
    return;
  }

  methodNotAllowed(res, ['GET', 'POST']);
}

async function byId(req: VercelRequest, res: VercelResponse, ctx: RequestContext, id: string) {
  const { supabase } = ctx;

  if (req.method === 'PATCH') {
    const updates: ProjectUpdate = {};
    for (const field of PATCHABLE_FIELDS) {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) { badRequest(res, 'No updatable fields provided'); return; }

    const { data, error } = await supabase.from('mapping_projects').update(updates).eq('id', id).select(PROJECT_COLUMNS).single();
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  methodNotAllowed(res, ['PATCH']);
}
