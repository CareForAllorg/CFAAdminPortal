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
    expect(res._body).toEqual({ path: 'date-1/attendance.csv', attendeeCount: 2 });
    const calls = (ctx.supabase as unknown as MockSupabase).calls;
    expect(calls.storageBuckets).toEqual(['mapathon-attendance']);
    expect(calls.uploads[0][0]).toBe('date-1/attendance.csv');
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
