import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';

// Whether an entire resource section (e.g. "Toolkits") is hidden from the
// member dashboard, independent of whether any individual resource in it
// is published -- see 20260827000001_resource_category_settings.sql.
// One row per category that's ever been toggled; a category with no row
// is visible by default.
export async function resourceCategorySettings(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  const { supabase } = ctx;

  if (sub) {
    if (req.method !== 'PATCH') {
      methodNotAllowed(res, ['PATCH']);
      return;
    }

    const category = decodeURIComponent(sub);
    const hidden = req.body?.hidden;
    if (typeof hidden !== 'boolean') { badRequest(res, 'hidden must be a boolean'); return; }

    const { data, error } = await supabase
      .from('resource_category_settings')
      .upsert({ category, hidden }, { onConflict: 'category' })
      .select('category, hidden')
      .single();
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const { data, error } = await supabase.from('resource_category_settings').select('category, hidden');
  if (error) { throw error; }
  sendJson(res, 200, { data });
}
