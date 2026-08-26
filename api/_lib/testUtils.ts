import type { VercelResponse } from '@vercel/node';
import type { User } from '@supabase/supabase-js';
import type { RequestContext } from './auth.js';

export interface MockResponse extends VercelResponse {
  _status: number | null;
  _headers: Record<string, string>;
  _body: unknown;
}

export function mockRes(): MockResponse {
  const res = {
    _status: null as number | null,
    _headers: {} as Record<string, string>,
    _body: undefined as unknown,
    status(code: number) { this._status = code; return this; },
    setHeader(name: string, value: string) { this._headers[name] = value; return this; },
    json(body: unknown) { this._body = body; return this; },
  };
  return res as unknown as MockResponse;
}

export interface MockSupabaseOptions {
  selectData?: unknown;
  selectError?: unknown;
  // Handlers that query more than one table (e.g. impact.ts) need distinct
  // results per .from(table) call -- per-table data wins over selectData.
  selectByTable?: Record<string, { data?: unknown; error?: unknown }>;
  insertData?: unknown;
  insertError?: unknown;
  updateData?: unknown;
  updateError?: unknown;
  deleteError?: unknown;
  storageUploadError?: unknown;
}

export interface MockCalls {
  selects: unknown[][];
  orders: unknown[][];
  inserts: unknown[][];
  updates: unknown[][];
  eqs: unknown[][];
  deletes: unknown[][];
  uploads: unknown[][];
  storageBuckets: string[];
  ins: unknown[][];
}

export interface MockSupabase {
  calls: MockCalls;
  from(table: string): {
    select(...args: unknown[]): unknown;
    insert(...args: unknown[]): unknown;
    update(...args: unknown[]): unknown;
    delete(...args: unknown[]): unknown;
  };
  storage: {
    from(bucket: string): {
      upload(...args: unknown[]): Promise<{ data: { path: string } | null; error: unknown }>;
    };
  };
}

// Chain fake for the handful of supabase-js query shapes the API handlers
// use (see the PR's testUtils spec): GET select().order(), POST
// insert().select().single(), PATCH update().eq().select().single(),
// DELETE delete().eq(), plus storage.from().upload(). Each hop records its
// arguments in `calls` so tests can assert exactly what was sent, and the
// final result carries the data/error chosen in MockSupabaseOptions.
export function mockSupabase(opts: MockSupabaseOptions = {}): MockSupabase {
  const calls: MockCalls = {
    selects: [], orders: [], inserts: [], updates: [], eqs: [], deletes: [], uploads: [], storageBuckets: [], ins: [],
  };

  const result = (data: unknown, error: unknown) => ({
    data: data ?? null,
    error: error ?? null,
    select(...args: unknown[]) { calls.selects.push(args); return this; },
    order(...args: unknown[]) { calls.orders.push(args); return this; },
    in(...args: unknown[]) { calls.ins.push(args); return this; },
    eq(...args: unknown[]) { calls.eqs.push(args); return this; },
    single() { return this; },
    maybeSingle() { return this; },
  });

  const makeTable = (tableName: string) => ({
    select(...args: unknown[]) {
      calls.selects.push(args);
      const per = opts.selectByTable?.[tableName];
      return result(per?.data ?? opts.selectData, per?.error ?? opts.selectError);
    },
    insert(...args: unknown[]) {
      calls.inserts.push(args);
      // Carries data/error at the top level too (not just behind
      // .select()) -- real supabase-js resolves a bare `insert(rows)` with
      // no .select() chain directly to { data, error }, which some
      // handlers (e.g. uploadMapathonAttendance's service_logs insert)
      // rely on without ever chaining .select().
      return result(opts.insertData, opts.insertError);
    },
    update(...args: unknown[]) {
      calls.updates.push(args);
      return {
        eq(...eArgs: unknown[]) {
          calls.eqs.push(eArgs);
          // Carries data/error at the top level too (not just behind
          // .select()) -- real supabase-js resolves a bare
          // `.update(x).eq(...)` with no .select() chain directly to
          // { data, error }, which some handlers rely on without ever
          // chaining .select().
          return result(opts.updateData, opts.updateError);
        },
      };
    },
    delete(...args: unknown[]) {
      calls.deletes.push(args);
      return {
        eq(...eArgs: unknown[]) {
          calls.eqs.push(eArgs);
          return { error: opts.deleteError ?? null };
        },
      };
    },
  });

  return {
    calls,
    from: (tableName: string) => makeTable(tableName),
    storage: {
      from: (bucket: string) => {
        calls.storageBuckets.push(bucket);
        return {
          upload: async (...args: unknown[]) => {
            calls.uploads.push(args);
            return { data: { path: String(args[0]) }, error: opts.storageUploadError ?? null };
          },
        };
      },
    },
  };
}

// Builds a RequestContext for handler tests -- a real-typed `user`/`role`
// plus the mockSupabase chain fake cast into the SupabaseClient slot.
export function mockCtx(opts: MockSupabaseOptions = {}): RequestContext {
  return {
    user: { id: 'test-user' } as User,
    role: 'admin',
    supabase: mockSupabase(opts) as unknown as RequestContext['supabase'],
  };
}
