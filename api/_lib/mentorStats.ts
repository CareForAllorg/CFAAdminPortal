export type MentorBucket = 'office' | 'impact' | 'curriculum' | 'other';
export const STENCIL_KEYS = ['resource', 'workshop', 'letter', 'infographic'] as const;
export type StencilKey = (typeof STENCIL_KEYS)[number];

export interface MentorStatLogRow {
  user_id: string | null;
  name: string | null;
  activity_type: string;
  hours: number;
  submitted_at: string;
  verification_details: unknown;
}

// Keys for the dated series the Impact page's Mentors view charts. Counts
// add 1 per approved submission; hours add that submission's hours; each
// stencil type adds 1 per submission that actually contains that file.
export type MentorEventKey =
  | 'office-sessions' | 'office-hours'
  | 'impact-sessions' | 'impact-hours'
  | 'curriculum-submissions' | 'curriculum-hours'
  | StencilKey;
export interface MentorEvent { date: string; magnitude: number }
export type MentorEvents = Record<MentorEventKey, MentorEvent[]>;

export interface CountHours { count: number; hours: number }
export interface CurriculumStats extends CountHours { stencils: Record<StencilKey, number> }

export interface MentorStatBlock {
  office: CountHours;
  impact: CountHours;
  curriculum: CurriculumStats;
  // Approved logs by this mentor that fit none of the buckets above (their
  // own mapping hours, an unrecognised office-hours label, ...) -- tracked
  // so a mentor's whole approved activity is accounted for somewhere.
  other: CountHours;
}

export interface MentorStatsResult {
  events: MentorEvents;
  totals: MentorStatBlock & { other: { types: string[] } };
  mentors: (MentorStatBlock & { userId: string | null; name: string })[];
}

// service_logs.activity_type is free text. Office hours and the
// "Impact Hours & Quarterly Check-Ins" mentors log aren't distinguished
// by any enum, so this matches on keywords in priority order: curriculum
// first (its rows carry the stencil files), then office hours, then
// impact hours / check-ins. Anything else that was pulled in as
// mentor-related lands in 'other' and is reported by name, so a
// mislabelled type shows up instead of silently vanishing from the totals.
export function classifyMentorActivity(activityType: string): MentorBucket {
  const t = (activityType || '').toLowerCase();
  if (t.includes('curriculum')) { return 'curriculum'; }
  if (t.includes('office')) { return 'office'; }
  if (t.includes('impact') || t.includes('check')) { return 'impact'; }
  return 'other';
}

function emptyBlock(): MentorStatBlock {
  return {
    office: { count: 0, hours: 0 },
    impact: { count: 0, hours: 0 },
    curriculum: { count: 0, hours: 0, stencils: { resource: 0, workshop: 0, letter: 0, infographic: 0 } },
    other: { count: 0, hours: 0 },
  };
}

function stencilsPresent(details: unknown): StencilKey[] {
  if (!details || typeof details !== 'object') { return []; }
  const stencils = (details as { stencils?: Record<string, { path?: unknown } | null> }).stencils;
  if (!stencils || typeof stencils !== 'object') { return []; }
  return STENCIL_KEYS.filter((key) => {
    const entry = stencils[key];
    return !!entry && typeof entry.path === 'string' && entry.path !== '';
  });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function emptyEvents(): MentorEvents {
  return {
    'office-sessions': [], 'office-hours': [],
    'impact-sessions': [], 'impact-hours': [],
    'curriculum-submissions': [], 'curriculum-hours': [],
    resource: [], workshop: [], letter: [], infographic: [],
  };
}

export function computeMentorStats(rows: MentorStatLogRow[], nameByUserId: Record<string, string> = {}): MentorStatsResult {
  const totals = emptyBlock();
  const events = emptyEvents();
  const otherTypes = new Set<string>();
  const byMentor = new Map<string, MentorStatBlock & { userId: string | null; name: string }>();

  // Every known mentor gets a row, even with no approved activity yet --
  // "who hasn't logged anything" is as useful here as who has.
  Object.entries(nameByUserId).forEach(([userId, name]) => {
    byMentor.set(userId, { ...emptyBlock(), userId, name });
  });

  rows.forEach((row) => {
    const bucket = classifyMentorActivity(row.activity_type);
    const hours = Number(row.hours) || 0;

    const mentorKey = row.user_id ?? `name:${(row.name || 'Unknown').toLowerCase()}`;
    let mentor = byMentor.get(mentorKey);
    if (!mentor) {
      mentor = { ...emptyBlock(), userId: row.user_id, name: (row.user_id && nameByUserId[row.user_id]) || row.name || 'Unknown' };
      byMentor.set(mentorKey, mentor);
    }

    if (bucket === 'other') {
      otherTypes.add(row.activity_type);
      [totals, mentor].forEach((block) => {
        block.other.count += 1;
        block.other.hours += hours;
      });
      return;
    }

    const when = row.submitted_at;
    if (bucket === 'curriculum') {
      events['curriculum-submissions'].push({ date: when, magnitude: 1 });
      events['curriculum-hours'].push({ date: when, magnitude: hours });
      stencilsPresent(row.verification_details).forEach((key) => { events[key].push({ date: when, magnitude: 1 }); });
    } else {
      events[`${bucket}-sessions`].push({ date: when, magnitude: 1 });
      events[`${bucket}-hours`].push({ date: when, magnitude: hours });
    }

    [totals, mentor].forEach((block) => {
      if (bucket === 'curriculum') {
        block.curriculum.count += 1;
        block.curriculum.hours += hours;
        stencilsPresent(row.verification_details).forEach((key) => { block.curriculum.stencils[key] += 1; });
      } else {
        block[bucket].count += 1;
        block[bucket].hours += hours;
      }
    });
  });

  const roundBlock = (b: MentorStatBlock) => {
    b.office.hours = round1(b.office.hours);
    b.impact.hours = round1(b.impact.hours);
    b.curriculum.hours = round1(b.curriculum.hours);
    b.other.hours = round1(b.other.hours);
  };
  roundBlock(totals);
  const mentors = Array.from(byMentor.values()).sort((a, b) => a.name.localeCompare(b.name));
  mentors.forEach(roundBlock);

  return { events, totals: { ...totals, other: { ...totals.other, types: Array.from(otherTypes).sort() } }, mentors };
}
