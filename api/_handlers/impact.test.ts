import { describe, expect, it } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import { impact } from './impact.js';
import { mockCtx, mockRes } from '../_lib/testUtils.js';

function req(method = 'GET'): VercelRequest {
  return { method } as unknown as VercelRequest;
}

interface LogRow {
  user_id: string | null;
  primary_impact: string | null;
  impact_magnitude: number | null;
  secondary_impact: string | null;
  secondary_impact_magnitude: number | null;
  submitted_at: string | null;
}

function sum(events: { magnitude: number }[]): number {
  return events.reduce((s, e) => s + e.magnitude, 0);
}

describe('impact /events mapping calculation', () => {
  it('adds mapathon self-reported totals on top of the member total', async () => {
    const logs: LogRow[] = [
      {
        user_id: 'u1',
        primary_impact: 'Buildings Mapped',
        impact_magnitude: 50,
        secondary_impact: null,
        secondary_impact_magnitude: null,
        submitted_at: '2026-01-10T00:00:00Z',
      },
    ];
    const mapathons = [{ event_date: '2026-02-01', total_buildings_mapped: 30, total_km_roads_mapped: 5 }];

    const res = mockRes();
    await impact(req(), res, mockCtx({
      selectByTable: {
        profiles: { data: [{ created_at: '2026-01-01T00:00:00Z' }] },
        chapters: { data: [] },
        service_logs: { data: logs },
        mapathon_dates: { data: mapathons },
      },
    }), 'events');

    expect(res._status).toBe(200);
    const body = res._body as { categories: Record<string, { date: string; magnitude: number }[]> };

    const buildings = body.categories['Buildings Mapped'];
    expect(sum(buildings)).toBe(80);
    expect(buildings).toContainEqual({ date: '2026-01-10T00:00:00Z', magnitude: 50 });
    expect(buildings).toContainEqual({ date: '2026-02-01', magnitude: 30 });

    const roads = body.categories['Roads Mapped'];
    expect(roads).toContainEqual({ date: '2026-02-01', magnitude: 5 });
    expect(sum(roads)).toBe(5);
  });

  it('still counts only each member\'s latest mapping submission', async () => {
    const logs: LogRow[] = [
      {
        user_id: 'u1',
        primary_impact: 'Buildings Mapped',
        impact_magnitude: 50,
        secondary_impact: null,
        secondary_impact_magnitude: null,
        submitted_at: '2026-01-10T00:00:00Z',
      },
      {
        user_id: 'u1',
        primary_impact: 'Buildings Mapped',
        impact_magnitude: 60,
        secondary_impact: null,
        secondary_impact_magnitude: null,
        submitted_at: '2026-01-20T00:00:00Z',
      },
    ];
    const mapathons = [{ event_date: '2026-02-01', total_buildings_mapped: 30, total_km_roads_mapped: 0 }];

    const res = mockRes();
    await impact(req(), res, mockCtx({
      selectByTable: {
        profiles: { data: [] },
        chapters: { data: [] },
        service_logs: { data: logs },
        mapathon_dates: { data: mapathons },
      },
    }), 'events');

    const body = res._body as { categories: Record<string, { date: string; magnitude: number }[]> };
    const buildings = body.categories['Buildings Mapped'];
    // One member event (their latest, 60) + the mapathon's 30 = 90, not
    // 50 + 60 + 30.
    expect(buildings).toHaveLength(2);
    expect(sum(buildings)).toBe(90);
  });

  it('ignores mapathon dates that were never published (0 totals)', async () => {
    const mapathons = [{ event_date: '2026-02-01', total_buildings_mapped: 0, total_km_roads_mapped: 0 }];

    const res = mockRes();
    await impact(req(), res, mockCtx({
      selectByTable: {
        profiles: { data: [] },
        chapters: { data: [] },
        service_logs: { data: [] },
        mapathon_dates: { data: mapathons },
      },
    }), 'events');

    const body = res._body as { categories: Record<string, { date: string; magnitude: number }[]> };
    expect(body.categories['Buildings Mapped']).toBeUndefined();
    expect(body.categories['Roads Mapped']).toBeUndefined();
  });

  it('returns 404 unless sub is events', async () => {
    const res = mockRes();
    await impact(req(), res, mockCtx(), 'other');

    expect(res._status).toBe(404);
  });
});
