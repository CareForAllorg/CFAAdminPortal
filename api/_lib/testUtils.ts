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
    selects: [], orders: [], inserts: [], updates: [], eqs: [], deletes: [], uploads: [], storageBuckets: [],
  };

  const result = (data: unknown, error: unknown) => ({
    data: data ?? null,
    error: error ?? null,
    select(...args: unknown[]) { calls.selects.push(args); return this; },
    order(...args: unknown[]) { calls.orders.push(args); return this; },
    single() { return this; },
  });

  const table = {
    select(...args: unknown[]) {
      calls.selects.push(args);
      return result(opts.selectData, opts.selectError);
    },
    insert(...args: unknown[]) {
      calls.inserts.push(args);
      return {
        select(...sArgs: unknown[]) {
          calls.selects.push(sArgs);
          return result(opts.insertData, opts.insertError);
        },
      };
    },
    update(...args: unknown[]) {
      calls.updates.push(args);
      return {
        eq(...eArgs: unknown[]) {
          calls.eqs.push(eArgs);
          return {
            select(...sArgs: unknown[]) {
              calls.selects.push(sArgs);
              return result(opts.updateData, opts.updateError);
            },
          };
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
  };

  return {
    calls,
    from: () => table,
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
