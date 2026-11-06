import type { Metric } from './metrics';
import type { MentorStats } from './useMentorStats';

// Same Metric shape the Overall view's cards and chart already render, so
// the Mentors view reuses them unchanged. Each category gets two measurables
// -- how many were logged and the hours -- per the request for separate
// count and hour statistics.
const MENTOR_METRICS: { key: keyof MentorStats['events']; label: string }[] = [
  { key: 'office-sessions', label: 'Office Hour Sessions' },
  { key: 'office-hours', label: 'Office Hours' },
  { key: 'impact-sessions', label: 'Impact Hours & Quarterly Check-Ins (Sessions)' },
  { key: 'impact-hours', label: 'Impact Hours & Quarterly Check-Ins (Hours)' },
  { key: 'curriculum-submissions', label: 'Curriculum Submissions' },
  { key: 'curriculum-hours', label: 'Curriculum Development Hours' },
  { key: 'resource', label: 'Resource Roundups Created' },
  { key: 'workshop', label: 'Workshop Slide Sprints' },
  { key: 'letter', label: 'Letters to Leaders' },
  { key: 'infographic', label: 'Infographic Jams' },
];

export function mentorMetricList(stats: MentorStats): Metric[] {
  return MENTOR_METRICS.map(({ key, label }) => ({ key, label, events: stats.events[key] ?? [] }));
}
