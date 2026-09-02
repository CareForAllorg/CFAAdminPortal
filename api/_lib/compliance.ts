import type { VercelRequest } from '@vercel/node';
import type { RequestContext } from './auth.js';
import type { Database } from '../../src/types/database.generated.js';
import { firstQueryValue } from './pagination.js';
import { collectUserIds, fetchProfilesByUserId } from './joinProfiles.js';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
type Quarter = (typeof QUARTERS)[number];
type QuarterStatus = 'done' | 'overdue' | 'pending';

type ChapterCheckinRow = Pick<
  Database['public']['Tables']['chapter_checkins']['Row'],
  | 'id' | 'chapter_name' | 'quarter' | 'activities' | 'member_count' | 'challenges' | 'submitted_at'
  | 'meeting_helpfulness' | 'guidance_rating' | 'understanding_rating' | 'community_engagement_rating'
  | 'total_hours' | 'structural_changes' | 'guidelines_compliance'
>;
type Deadlines = Partial<Pick<Database['public']['Tables']['checkin_deadlines']['Row'], 'q1' | 'q2' | 'q3' | 'q4'>>;

export interface EnrichedChapter {
  id: string;
  name: string;
  createdAt: string;
  lead: string;
  memberCount: number;
  projectCount: number;
  projectCountOverride: number | null;
  quarterStatuses: QuarterStatus[];
  checkins: ChapterCheckinRow[];
  compliant: boolean;
  // Self-reported by the chapter lead in the Volunteer Portal's Onboarding
  // Checklist (chapters.meta.onboarding_checklist) -- three items in a
  // fixed order (Watch Onboarding Video, Draft Constitution & Set Up,
  // Add Prospective Members), not verified completion of any of them.
  onboardingChecklist: boolean[];
  // A program partner signed up through the Volunteer Portal's "Partner
  // With Us" flow (chapters.meta.is_partner) -- they use Chapter Hub like
  // any chapter, but don't submit quarterly check-ins, so that leg of
  // annual compliance doesn't apply to them.
  isPartner: boolean;
}

export interface ChapterComplianceResult {
  enriched: EnrichedChapter[];
  deadlines: Deadlines;
  currentYear: number;
}

// The annual-chapter-compliance derivation shared by /api/chapters/enriched
// and /api/overview/stats so the Chapters page and the Admin Overview's
// "non-compliant" count can never disagree on what compliance means. Still
// a computed view (2+ projects/year, all 4 quarterly check-ins), not a
// real `chapters_enriched` table.
export async function computeChapterCompliance(req: VercelRequest, ctx: RequestContext): Promise<ChapterComplianceResult> {
  const { supabase } = ctx;

  const yearParam = firstQueryValue(req, 'year');
  const currentYear = yearParam ? Number(yearParam) : new Date().getFullYear();

  const [chaptersRes, profilesRes, checkinsRes, projectLogsRes, deadlinesRes] = await Promise.all([
    supabase.from('chapters').select('id, name, created_at, project_count_override, meta').order('name'),
    supabase.from('profiles').select('id, first_name, last_name, chapter_id, role'),
    supabase.from('chapter_checkins')
      .select('id, chapter_name, quarter, activities, member_count, challenges, submitted_at, meeting_helpfulness, guidance_rating, understanding_rating, community_engagement_rating, total_hours, structural_changes, guidelines_compliance')
      .order('submitted_at', { ascending: false }),
    supabase.from('service_logs').select('user_id, activity_type').eq('status', 'approved').ilike('activity_type', '%project%')
      .gte('submitted_at', `${currentYear}-01-01`).lt('submitted_at', `${currentYear + 1}-01-01`),
    supabase.from('checkin_deadlines').select('year, q1, q2, q3, q4').eq('year', currentYear).maybeSingle(),
  ]);

  if (chaptersRes.error) { throw chaptersRes.error; }
  if (profilesRes.error) { throw profilesRes.error; }
  if (checkinsRes.error) { throw checkinsRes.error; }
  if (projectLogsRes.error) { throw projectLogsRes.error; }
  if (deadlinesRes.error) { throw deadlinesRes.error; }

  const chaptersData = chaptersRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const checkins = checkinsRes.data ?? [];
  const projectLogs = projectLogsRes.data ?? [];
  const deadlines: Deadlines = deadlinesRes.data ?? {};

  const memberCountByChapterId: Record<string, number> = {};
  const leadNamesByChapterId: Record<string, string[]> = {};
  profiles.forEach((p) => {
    if (!p.chapter_id) { return; }
    memberCountByChapterId[p.chapter_id] = (memberCountByChapterId[p.chapter_id] || 0) + 1;
    if (p.role === 'chapter_lead') {
      const name = ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || '-';
      (leadNamesByChapterId[p.chapter_id] ??= []).push(name);
    }
  });
  // A chapter can have co-leads, not just one -- join every chapter_lead's
  // name rather than only the first one found in the profiles list.
  const leadByChapterId: Record<string, string> = {};
  Object.keys(leadNamesByChapterId).forEach((chapterId) => {
    leadByChapterId[chapterId] = leadNamesByChapterId[chapterId].join(', ');
  });

  // service_logs.user_id has no direct FK to profiles (see
  // api/_lib/joinProfiles.ts), so this is a second lookup rather than a
  // PostgREST embed.
  const projectProfileById = await fetchProfilesByUserId(supabase, collectUserIds(projectLogs));
  const projectCountByChapterId: Record<string, number> = {};
  projectLogs.forEach((log) => {
    const chapterId = log.user_id ? projectProfileById[log.user_id]?.chapter_id : null;
    if (chapterId) { projectCountByChapterId[chapterId] = (projectCountByChapterId[chapterId] || 0) + 1; }
  });

  const dueDateByQuarter: Record<Quarter, string | null | undefined> = {
    Q1: deadlines.q1, Q2: deadlines.q2, Q3: deadlines.q3, Q4: deadlines.q4,
  };

  const checkinsByChapterName: Record<string, ChapterCheckinRow[]> = {};
  checkins.forEach((c) => {
    const key = (c.chapter_name || '').trim();
    if (!checkinsByChapterName[key]) { checkinsByChapterName[key] = []; }
    checkinsByChapterName[key].push(c);
  });

  const today = new Date();

  const enrichedChapters: EnrichedChapter[] = chaptersData.map((ch) => {
    const chapterCheckins = checkinsByChapterName[ch.name] || [];

    const quarterStatuses: QuarterStatus[] = QUARTERS.map((q) => {
      // The volunteer portal's check-in form stores quarter as e.g.
      // "Q1 (Jan - Mar)", not the bare "Q1" this compares against -- a
      // strict equality here never matched anything, so every chapter's
      // check-ins looked perpetually pending/overdue no matter what was
      // actually submitted. Match on the leading "Q1"/"Q2"/"Q3"/"Q4"
      // instead of the full descriptive string.
      const submitted = chapterCheckins.find(
        (c) => (c.quarter || '').trim().startsWith(q) && !!c.submitted_at && new Date(c.submitted_at).getFullYear() === currentYear
      );
      if (submitted) { return 'done'; }

      const dueDate = dueDateByQuarter[q];
      if (dueDate && new Date(dueDate) < today) { return 'overdue'; }
      return 'pending';
    });

    const isPartner = !!(ch.meta as { is_partner?: boolean } | null)?.is_partner;
    const allCheckinsIn = isPartner || quarterStatuses.every((s) => s === 'done');
    const derivedProjectCount = projectCountByChapterId[ch.id] || 0;
    const projectCount = ch.project_count_override ?? derivedProjectCount;

    return {
      id: ch.id,
      name: ch.name,
      createdAt: ch.created_at,
      lead: leadByChapterId[ch.id] || '-',
      memberCount: memberCountByChapterId[ch.id] || 0,
      projectCount,
      projectCountOverride: ch.project_count_override,
      quarterStatuses,
      checkins: chapterCheckins,
      compliant: projectCount >= 2 && allCheckinsIn,
      onboardingChecklist: (ch.meta as { onboarding_checklist?: boolean[] } | null)?.onboarding_checklist ?? [false, false, false],
      isPartner,
    };
  });

  return { enriched: enrichedChapters, deadlines, currentYear };
}
