import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';
import type { ChapterCheckin, CheckinDeadline } from '../../types/database';

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type QuarterStatus = 'done' | 'overdue' | 'pending';

export interface EnrichedChapter {
  id: string;
  name: string;
  createdAt: string;
  lead: string;
  memberCount: number;
  projectCount: number;
  projectCountOverride: number | null;
  quarterStatuses: QuarterStatus[];
  checkins: ChapterCheckin[];
  compliant: boolean;
  onboardingChecklist: boolean[];
}

interface EnrichedChaptersResponse {
  enriched: EnrichedChapter[];
  deadlines: Partial<CheckinDeadline>;
  currentYear: number;
}

const MARKED_COMPLETE_NOTE = 'Marked complete by admin (no submission on file).';

// The volunteer portal's own check-in form -- and its Chapter Hub
// "Check-Ins" tab that reads them back -- uses this full descriptive
// label, not bare "Q1"/"Q2"/"Q3"/"Q4". An admin-created check-in has to
// match it exactly, or a chapter lead marked complete here still shows
// "Not Submitted" on their own end even though this admin dashboard
// shows it as done.
const QUARTER_LABEL: Record<Quarter, string> = {
  Q1: 'Q1 (Jan - Mar)',
  Q2: 'Q2 (Apr - Jun)',
  Q3: 'Q3 (Jul - Sep)',
  Q4: 'Q4 (Oct - Dec)',
};

// The compliance derivation itself now lives server-side in
// api/_handlers/chapters.ts's enriched() -- this hook fetches the
// computed view for the requested year and exposes the mark/unmark
// quarterly check-in action on top of it, reloading the computed view
// after each.
export function useChapterData() {
  const currentYear = new Date().getFullYear();
  const [enriched, setEnriched] = useState<EnrichedChapter[]>([]);
  const [deadlines, setDeadlines] = useState<Partial<CheckinDeadline>>({});
  const [loading, setLoading] = useState(true);
  const [removingCheckinId, setRemovingCheckinId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await apiOrToast(
      api.get<EnrichedChaptersResponse>(`/chapters/enriched?year=${currentYear}`),
      'Loading chapters',
      { enriched: [], deadlines: {}, currentYear }
    );

    setEnriched(result.enriched);
    setDeadlines(result.deadlines);
    setLoading(false);
  }, [currentYear]);

  useEffect(() => {
    load();
  }, [load]);

  async function markQuarterComplete(chapterName: string, quarter: Quarter) {
    const ok = await mutateOrToast(
      api.post('/chapter-checkins', { chapter_name: chapterName, quarter: QUARTER_LABEL[quarter], activities: MARKED_COMPLETE_NOTE }),
      'Marking check-in complete'
    );
    if (ok) { await load(); }
  }

  async function unmarkQuarterComplete(checkinId: string) {
    setRemovingCheckinId(checkinId);
    const ok = await mutateOrToast(api.delete(`/chapter-checkins/${checkinId}`), 'Removing check-in');
    if (ok) { await load(); }
    setRemovingCheckinId(null);
  }

  async function setProjectCountOverride(chapterId: string, value: number | null) {
    const ok = await mutateOrToast(
      api.patch(`/chapters/${chapterId}`, { project_count_override: value }),
      'Updating project count'
    );
    if (ok) { await load(); }
  }

  return {
    enriched,
    deadlines,
    currentYear,
    loading,
    removingCheckinId,
    reload: load,
    markQuarterComplete,
    unmarkQuarterComplete,
    setProjectCountOverride,
  };
}
