import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';
import { useServiceLogsRealtime } from '../../lib/useServiceLogsRealtime';
import { resolveDisplay, type EmbeddedProfile } from './shared';

export interface StencilFile {
  path: string;
  name: string;
}

export interface MentorshipSubmissionRow {
  id: string;
  user_id: string | null;
  name: string | null;
  org_name: string | null;
  activity_type: string;
  hours: number;
  submitted_at: string;
  description: string | null;
  proof_path: string | null;
  verification_details: { category?: string; stencils?: Record<string, StencilFile> } | null;
  displayName: string;
  displayChapter: string;
}

interface MentorshipSubmissionApiRow extends Omit<MentorshipSubmissionRow, 'displayName' | 'displayChapter'> {
  profiles: EmbeddedProfile | null;
}

export const MENTORSHIP_SUBMISSIONS_PAGE_SIZE = 20;

// Everything a mentor can log from the Mentorship tab's own logging paths
// (see VolunteerPortal's app/api/mentor-hours + app/api/mentor-curriculum) --
// kept out of the general Project & Impact queue (useSubmissions.ts) so
// mentor time doesn't get mixed in with student project submissions.
const MENTOR_ACTIVITY_CONTAINS = ['Mentor', 'Curriculum Development'];

export function useMentorshipSubmissions(onMutated: () => void) {
  const [submissions, setSubmissions] = useState<MentorshipSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const containsQuery = MENTOR_ACTIVITY_CONTAINS.map((v) => `activityTypeContains=${encodeURIComponent(v)}`).join('&');
    const result = await apiOrToast(
      api.get<{ data: MentorshipSubmissionApiRow[]; total: number }>(
        `/service-logs?status=pending&${containsQuery}&page=${page}&limit=${MENTORSHIP_SUBMISSIONS_PAGE_SIZE}`
      ),
      'Loading mentorship submissions',
      { data: [], total: 0 }
    );

    setTotal(result.total);
    setSubmissions(result.data.map((row) => {
      const display = resolveDisplay(row);
      return { ...row, displayName: display.name, displayChapter: display.chapter };
    }));
    setLoading(false);

    if (result.data.length === 0 && page > 1) {
      setPage((p) => Math.max(1, p - 1));
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  useServiceLogsRealtime(load);

  async function updateSubmissionStatus(logId: string, newStatus: 'approved' | 'rejected') {
    const ok = await mutateOrToast(api.patch(`/service-logs/${logId}`, { status: newStatus }), 'Updating submission');
    if (!ok) { return; }

    await load();
    onMutated();
  }

  return { submissions, loading, page, setPage, total, pageSize: MENTORSHIP_SUBMISSIONS_PAGE_SIZE, updateSubmissionStatus };
}
