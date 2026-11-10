import type { VercelRequest } from '@vercel/node';

export interface PageParams {
  page: number;
  limit: number;
  from: number;
  to: number;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Shared page/limit -> Postgres .range(from, to) conversion, so every
// paginated endpoint parses query params the same way instead of each
// handler reimplementing its own clamping rules.
export function parsePageParams(req: VercelRequest, defaultLimit = DEFAULT_LIMIT): PageParams {
  const rawPage = Number(firstValue(req.query.page));
  const rawLimit = Number(firstValue(req.query.limit));

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
    : defaultLimit;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  return { page, limit, from, to };
}

export function firstQueryValue(req: VercelRequest, key: string): string | undefined {
  return firstValue(req.query[key]);
}

// Same repeated-key query param (`?key=a&key=b`) as firstQueryValue reads
// the first of, but returning every value -- for filters where a caller
// needs to OR/AND together more than one match (e.g. activityTypeContains).
export function allQueryValues(req: VercelRequest, key: string): string[] {
  const v = req.query[key];
  if (v === undefined) { return []; }
  return Array.isArray(v) ? v : [v];
}
