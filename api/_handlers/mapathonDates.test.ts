import { describe, expect, it } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import { mapathonDates } from './mapathonDates.js';
import { mockCtx, mockRes, type MockSupabase } from '../_lib/testUtils.js';

function req(method: string, body?: unknown): VercelRequest {
  return { method, body } as unknown as VercelRequest;
}

const MOCK_ROW = {
  id: 'date-1',
  event_date: '2026-01-01',
  hours: 4,
  label: 'January mapathon',
  created_at: '2026-01-01T00:00:00Z',
  total_buildings_mapped: 12,
  total_km_roads_mapped: 3.5,
  bonus_service_hours: 2,
  attendance_list_path: null,
};

describe('mapathonDates POST', () => {
  it('rejects hours <= 0', async () => {
    const res = mockRes();
    const ctx = mockCtx({ insertData: MOCK_ROW });
    await mapathonDates(req('POST', { event_date: '2026-01-01', hours: 0 }), res, ctx);

    expect(res._status).toBe(400);
    expect(res._body).toEqual({ error: 'hours must be a positive number' });
    expect((ctx.supabase as unknown as MockSupabase).calls.inserts.length).toBe(0);
  });

  it('rejects negative stats', async () => {
    const res = mockRes();
    const ctx = mockCtx({ insertData: MOCK_ROW });
    await mapathonDates(
      req('POST', { event_date: '2026-01-01', hours: 4, total_buildings_mapped: -1 }),
      res,
      ctx,
    );

    expect(res._status).toBe(400);
    expect(res._body).toEqual({ error: 'total_buildings_mapped must be a non-negative number' });
    expect((ctx.supabase as unknown as MockSupabase).calls.inserts.length).toBe(0);
  });

  it('accepts valid stats and inserts them', async () => {
    const res = mockRes();
    const ctx = mockCtx({ insertData: MOCK_ROW });
    await mapathonDates(
      req('POST', {
        event_date: '2026-01-01',
        hours: 4,
        label: 'January mapathon',
        total_buildings_mapped: 12,
        total_km_roads_mapped: 3.5,
        bonus_service_hours: 0,
      }),
      res,
      ctx,
    );

    expect(res._status).toBe(201);
    expect(res._body).toEqual({ data: MOCK_ROW });
    const inserted = (ctx.supabase as unknown as MockSupabase).calls.inserts[0][0];
    expect(inserted).toEqual({
      event_date: '2026-01-01',
      hours: 4,
      label: 'January mapathon',
      total_buildings_mapped: 12,
      total_km_roads_mapped: 3.5,
      bonus_service_hours: 0,
    });
  });

  it('omits absent stats so the DB defaults apply', async () => {
    const res = mockRes();
    const ctx = mockCtx({ insertData: MOCK_ROW });
    await mapathonDates(req('POST', { event_date: '2026-01-01', hours: 4 }), res, ctx);

    expect(res._status).toBe(201);
    const inserted = (ctx.supabase as unknown as MockSupabase).calls.inserts[0][0];
    expect(inserted).toEqual({ event_date: '2026-01-01', hours: 4, label: null });
  });
});

describe('mapathonDates PATCH', () => {
  it('accepts valid stats and patches them', async () => {
    const res = mockRes();
    const ctx = mockCtx({ updateData: { ...MOCK_ROW, bonus_service_hours: 5 } });
    await mapathonDates(req('PATCH', { bonus_service_hours: 5, label: 'Renamed' }), res, ctx, 'date-1');

    expect(res._status).toBe(200);
    const calls = (ctx.supabase as unknown as MockSupabase).calls;
    expect(calls.updates[0][0]).toEqual({ bonus_service_hours: 5, label: 'Renamed' });
    expect(calls.eqs[0]).toEqual(['id', 'date-1']);
  });

  it('rejects negative values', async () => {
    const res = mockRes();
    const ctx = mockCtx({ updateData: MOCK_ROW });
    await mapathonDates(req('PATCH', { total_km_roads_mapped: -0.1 }), res, ctx, 'date-1');

    expect(res._status).toBe(400);
    expect(res._body).toEqual({ error: 'total_km_roads_mapped must be a non-negative number' });
    expect((ctx.supabase as unknown as MockSupabase).calls.updates.length).toBe(0);
  });

  it('allows an explicit null to clear attendance_list_path', async () => {
    const res = mockRes();
    const ctx = mockCtx({ updateData: { ...MOCK_ROW, attendance_list_path: null } });
    await mapathonDates(req('PATCH', { attendance_list_path: null }), res, ctx, 'date-1');

    expect(res._status).toBe(200);
    expect((ctx.supabase as unknown as MockSupabase).calls.updates[0][0]).toEqual({
      attendance_list_path: null,
    });
  });

  it('ignores non-whitelisted fields like created_at', async () => {
    const res = mockRes();
    const ctx = mockCtx({ updateData: { ...MOCK_ROW, label: 'y' } });
    await mapathonDates(
      req('PATCH', { created_at: '2020-01-01T00:00:00Z', label: 'y' }),
      res,
      ctx,
      'date-1',
    );

    expect(res._status).toBe(200);
    expect((ctx.supabase as unknown as MockSupabase).calls.updates[0][0]).toEqual({ label: 'y' });
  });
});

describe('mapathonDates DELETE', () => {
  it('reverses previously credited hours/buildings/roads before deleting the date', async () => {
    const res = mockRes();
    const ctx = mockCtx({
      selectByTable: {
        service_logs: { data: [{ user_id: 'user-1', impact_magnitude: 10, secondary_impact_magnitude: 5 }] },
        profiles: { data: { buildings_mapped: 30, km_roads_mapped: 13 } },
      },
    });
    await mapathonDates(req('DELETE'), res, ctx, 'date-1');

    expect(res._status).toBe(204);
    const calls = (ctx.supabase as unknown as MockSupabase).calls;
    // service_logs rows for this date get deleted (reversal)...
    expect(calls.eqs).toContainEqual(['mapathon_date_id', 'date-1']);
    // ...and the credited member's profile totals get the delta subtracted back out.
    const updates = calls.updates as unknown as Array<[Record<string, unknown>]>;
    expect(updates[updates.length - 1][0]).toEqual({ buildings_mapped: 20, km_roads_mapped: 8 });
    // ...then the mapathon_dates row itself is deleted.
    expect(calls.eqs).toContainEqual(['id', 'date-1']);
  });
});

describe('mapathonDates method handling', () => {
  it('returns 405 for unsupported methods on the collection', async () => {
    const res = mockRes();
    await mapathonDates(req('PUT'), res, mockCtx());

    expect(res._status).toBe(405);
    expect(res._headers.Allow).toBe('GET, POST');
  });

  it('returns 405 for unsupported methods on a single date', async () => {
    const res = mockRes();
    await mapathonDates(req('PUT'), res, mockCtx(), 'date-1');

    expect(res._status).toBe(405);
    expect(res._headers.Allow).toBe('PATCH, DELETE');
  });
});
