import { describe, expect, it } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import { uploadMapathonAttendance } from './uploads.js';
import { mockCtx, mockRes, type MockSupabase } from '../_lib/testUtils.js';

function req(method: string, body?: unknown): VercelRequest {
  return { method, body } as unknown as VercelRequest;
}

const VALID_CSV = 'name,email\nAlice,a@x.com\nBob,b@x.com\n';

describe('uploadMapathonAttendance', () => {
  it('rejects a non-CSV dataUrl', async () => {
    const res = mockRes();
    await uploadMapathonAttendance(req('POST', { dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }), res, mockCtx());

    expect(res._status).toBe(400);
    expect(res._body).toEqual({ error: 'dataUrl must be a base64-encoded text/csv or application/csv file' });
  });

  it('rejects a CSV larger than 5MB', async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 97);
    const res = mockRes();
    await uploadMapathonAttendance(
      req('POST', { dataUrl: `data:text/csv;base64,${oversized.toString('base64')}` }),
      res,
      mockCtx(),
    );

    expect(res._status).toBe(400);
    expect(res._body).toEqual({ error: 'CSV file must be 5MB or smaller' });
  });

  it('rejects a header-only CSV', async () => {
    const res = mockRes();
    await uploadMapathonAttendance(
      req('POST', { dataUrl: `data:text/csv;base64,${Buffer.from('name,email\n').toString('base64')}` }),
      res,
      mockCtx(),
    );

    expect(res._status).toBe(400);
    expect(res._body).toEqual({ error: 'CSV must include at least one attendee row below the header' });
  });

  it('rejects a CSV with no rows at all', async () => {
    const res = mockRes();
    await uploadMapathonAttendance(
      req('POST', { dataUrl: `data:text/csv;base64,${Buffer.from('\n').toString('base64')}` }),
      res,
      mockCtx(),
    );

    expect(res._status).toBe(400);
    expect(res._body).toEqual({ error: 'CSV must include a header row and at least one attendee row' });
  });

  it('uploads a valid CSV and returns path + attendeeCount', async () => {
    const res = mockRes();
    const ctx = mockCtx();
    await uploadMapathonAttendance(
      req('POST', {
        dataUrl: `data:text/csv;base64,${Buffer.from(VALID_CSV).toString('base64')}`,
        dateId: 'date-1',
      }),
      res,
      ctx,
    );

    expect(res._status).toBe(200);
    // No mapathon_dates row found for 'date-1' in this mock (selectData is
    // unset) -- crediting is skipped entirely rather than erroring, same as
    // a real not-found date would behave via maybeSingle().
    expect(res._body).toEqual({ path: 'date-1/attendance.csv', attendeeCount: 2, matchedCount: 0, unmatchedCount: 0 });
    const calls = (ctx.supabase as unknown as MockSupabase).calls;
    expect(calls.storageBuckets).toEqual(['mapathon-attendance']);
    expect(calls.uploads[0][0]).toBe('date-1/attendance.csv');
  });

  it('credits matched attendees, skips unmatched rows, and replaces prior credits for this date', async () => {
    const res = mockRes();
    const ctx = mockCtx({
      selectByTable: {
        mapathon_dates: {
          data: { hours: 2, event_date: '2026-08-20', label: 'August Mapathon', total_buildings_mapped: 10, total_km_roads_mapped: 5 },
        },
        users: { data: [{ id: 'user-1', name: 'Alice', email: 'a@x.com' }] },
        profiles: { data: { buildings_mapped: 20, km_roads_mapped: 8 } },
      },
    });
    await uploadMapathonAttendance(
      req('POST', {
        dataUrl: `data:text/csv;base64,${Buffer.from(VALID_CSV).toString('base64')}`,
        dateId: 'date-1',
      }),
      res,
      ctx,
    );

    expect(res._status).toBe(200);
    // Alice matches a real user (a@x.com); Bob doesn't.
    expect(res._body).toEqual({ path: 'date-1/attendance.csv', attendeeCount: 2, matchedCount: 1, unmatchedCount: 1 });

    const calls = (ctx.supabase as unknown as MockSupabase).calls;
    expect(calls.deletes.length).toBeGreaterThan(0);
    expect(calls.eqs).toContainEqual(['mapathon_date_id', 'date-1']);
    const insertedRows = calls.inserts[calls.inserts.length - 1][0] as Array<Record<string, unknown>>;
    expect(insertedRows).toEqual([
      {
        user_id: 'user-1',
        name: 'Alice',
        email: 'a@x.com',
        activity_type: 'Mapathon',
        hours: 2,
        status: 'approved',
        description: 'Mapathon attendance: August Mapathon',
        submitted_at: '2026-08-20',
        mapathon_date_id: 'date-1',
        primary_impact: 'Buildings Mapped',
        impact_magnitude: 10,
        secondary_impact: 'Roads Mapped',
        secondary_impact_magnitude: 5,
      },
    ]);

    // 10 buildings / 5 roads split across the 1 matched attendee, added on
    // top of Alice's existing 20/8 baseline.
    const updates = calls.updates as unknown as Array<[Record<string, unknown>]>;
    expect(updates[updates.length - 1][0]).toEqual({ buildings_mapped: 30, km_roads_mapped: 13 });
  });

  it('uses a timestamped path when dateId is omitted', async () => {
    const res = mockRes();
    const ctx = mockCtx();
    await uploadMapathonAttendance(
      req('POST', { dataUrl: `data:application/csv;base64,${Buffer.from(VALID_CSV).toString('base64')}` }),
      res,
      ctx,
    );

    expect(res._status).toBe(200);
    const { path, attendeeCount } = res._body as { path: string; attendeeCount: number };
    expect(path).toMatch(/^\d+\/attendance\.csv$/);
    expect(attendeeCount).toBe(2);
    expect((ctx.supabase as unknown as MockSupabase).calls.uploads[0][0]).toBe(path);
  });

  it('returns 405 for GET', async () => {
    const res = mockRes();
    await uploadMapathonAttendance(req('GET'), res, mockCtx());

    expect(res._status).toBe(405);
    expect(res._headers.Allow).toBe('POST');
  });
});
