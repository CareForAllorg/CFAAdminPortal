import { describe, expect, it } from 'vitest';
import { classifyMentorActivity, computeMentorStats, type MentorStatLogRow } from './mentorStats.js';

const stencils = (keys: string[]) => ({
  category: 'Asthma',
  stencils: Object.fromEntries(keys.map((k) => [k, { path: `u/verification/${k}.pdf`, name: `${k}.pdf` }])),
});

describe('classifyMentorActivity', () => {
  it('buckets by keyword in priority order', () => {
    expect(classifyMentorActivity('Curriculum Development')).toBe('curriculum');
    expect(classifyMentorActivity('Mentorship - Office Hours')).toBe('office');
    expect(classifyMentorActivity('Mentor Impact Hours')).toBe('impact');
    expect(classifyMentorActivity('Quarterly Check-In')).toBe('impact');
    expect(classifyMentorActivity('Mentorship Session')).toBe('other');
  });
});

describe('computeMentorStats', () => {
  const rows: MentorStatLogRow[] = [
    { user_id: 'a', name: 'Ann A', activity_type: 'Office Hours', hours: 1.5, submitted_at: '2026-08-02T00:00:00Z', verification_details: null },
    { user_id: 'a', name: 'Ann A', activity_type: 'Office Hours', hours: 1, submitted_at: '2026-08-10T00:00:00Z', verification_details: null },
    { user_id: 'a', name: 'Ann A', activity_type: 'Mentor Impact Hours', hours: 2, submitted_at: '2026-08-10T00:00:00Z', verification_details: null },
    { user_id: 'a', name: 'Ann A', activity_type: 'Curriculum Development', hours: 3, submitted_at: '2026-08-10T00:00:00Z', verification_details: stencils(['workshop', 'infographic', 'resource', 'letter']) },
    { user_id: 'b', name: 'Ben B', activity_type: 'Curriculum Development', hours: 2, submitted_at: '2026-08-10T00:00:00Z', verification_details: stencils(['letter']) },
    { user_id: 'b', name: 'Ben B', activity_type: 'Mentorship Session', hours: 4, submitted_at: '2026-08-10T00:00:00Z', verification_details: null },
  ];

  it('counts submissions and sums hours separately per category', () => {
    const { totals } = computeMentorStats(rows);
    expect(totals.office).toEqual({ count: 2, hours: 2.5 });
    expect(totals.impact).toEqual({ count: 1, hours: 2 });
    expect(totals.curriculum.count).toBe(2);
    expect(totals.curriculum.hours).toBe(5);
  });

  it('counts each stencil type by presence, not by submission', () => {
    const { totals } = computeMentorStats(rows);
    expect(totals.curriculum.stencils).toEqual({ resource: 1, workshop: 1, letter: 2, infographic: 1 });
  });

  it('reports unmatched mentor activity by name instead of dropping it', () => {
    const { totals } = computeMentorStats(rows);
    expect(totals.other).toEqual({ count: 1, hours: 4, types: ['Mentorship Session'] });
  });

  it('emits dated events for the Impact page charts', () => {
    const { events } = computeMentorStats(rows);
    expect(events['office-sessions']).toHaveLength(2);
    expect(events['office-hours'].map((e) => e.magnitude)).toEqual([1.5, 1]);
    expect(events['impact-hours']).toEqual([{ date: '2026-08-10T00:00:00Z', magnitude: 2 }]);
    expect(events['curriculum-submissions']).toHaveLength(2);
    expect(events.letter).toHaveLength(2);
    expect(events.workshop).toHaveLength(1);
  });

  it('tracks unmatched logs per mentor as Other, separate from the real buckets', () => {
    const { mentors, totals } = computeMentorStats(rows, { a: 'Ann Alpha' });
    const ben = mentors.find((m) => m.name === 'Ben B');
    expect(ben?.other).toEqual({ count: 1, hours: 4 });
    expect(ben?.office.count).toBe(0);
    expect(mentors.find((m) => m.userId === 'a')?.other).toEqual({ count: 0, hours: 0 });
    expect(totals.other.count).toBe(1);
  });

  it('lists mentors with no approved activity too, with zeroed stats', () => {
    const { mentors } = computeMentorStats(rows, { a: 'Ann Alpha', z: 'Zed Zero' });
    const zed = mentors.find((m) => m.userId === 'z');
    expect(zed?.name).toBe('Zed Zero');
    expect(zed?.office).toEqual({ count: 0, hours: 0 });
    expect(zed?.curriculum.stencils).toEqual({ resource: 0, workshop: 0, letter: 0, infographic: 0 });
  });

  it('breaks stats out per mentor', () => {
    const { mentors } = computeMentorStats(rows, { a: 'Ann Alpha' });
    expect(mentors.map((m) => m.name)).toEqual(['Ann Alpha', 'Ben B']);
    expect(mentors[0].curriculum.stencils.workshop).toBe(1);
    expect(mentors[1].curriculum.stencils).toEqual({ resource: 0, workshop: 0, letter: 1, infographic: 0 });
    expect(mentors[1].office.count).toBe(0);
  });
});
