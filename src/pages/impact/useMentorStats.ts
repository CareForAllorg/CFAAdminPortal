import { useEffect, useState } from 'react';
import { api, apiOrToast } from '../../lib/apiClient';

export interface CountHours { count: number; hours: number }
export interface Stencils { resource: number; workshop: number; letter: number; infographic: number }
export interface MentorStatBlock {
  office: CountHours;
  impact: CountHours;
  curriculum: CountHours & { stencils: Stencils };
  other: CountHours;
}
export type MentorEventKey =
  | 'office-sessions' | 'office-hours' | 'impact-sessions' | 'impact-hours'
  | 'curriculum-submissions' | 'curriculum-hours'
  | 'resource' | 'workshop' | 'letter' | 'infographic';
export interface MentorStats {
  events: Record<MentorEventKey, { date: string; magnitude: number }[]>;
  totals: MentorStatBlock & { other: { types: string[] } };
  mentors: (MentorStatBlock & { userId: string | null; name: string })[];
}

const EMPTY: MentorStats = {
  events: {
    'office-sessions': [], 'office-hours': [], 'impact-sessions': [], 'impact-hours': [],
    'curriculum-submissions': [], 'curriculum-hours': [],
    resource: [], workshop: [], letter: [], infographic: [],
  },
  totals: {
    office: { count: 0, hours: 0 },
    impact: { count: 0, hours: 0 },
    curriculum: { count: 0, hours: 0, stencils: { resource: 0, workshop: 0, letter: 0, infographic: 0 } },
    other: { count: 0, hours: 0, types: [] },
  },
  mentors: [],
};

export function useMentorStats() {
  const [stats, setStats] = useState<MentorStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiOrToast(api.get<MentorStats>('/mentor-stats'), 'Loading mentor statistics', EMPTY).then((result) => {
      if (cancelled) { return; }
      setStats(result);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { stats, loading };
}
