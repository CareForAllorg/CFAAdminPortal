import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';
import { useServiceLogsRealtime } from '../../lib/useServiceLogsRealtime';
import { resolveDisplay, type EmbeddedProfile } from './shared';

export interface SubmissionRow {
  id: string;
  user_id: string | null;
  name: string | null;
  org_name: string | null;
  activity_type: string;
  hours: number;
  submitted_at: string;
  description: string | null;
  proof_path: string | null;
  displayName: string;
  displayChapter: string;
}

interface ServiceLogApiRow {
  id: string;
  user_id: string | null;
  name: string | null;
  org_name: string | null;
  activity_type: string;
  hours: number;
  submitted_at: string;
  description: string | null;
  proof_path: string | null;
  profiles: EmbeddedProfile | null;
}

export const SUBMISSIONS_PAGE_SIZE = 20;

export function useSubmissions(onMutated: () => void) {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    // Mapping and mapathon submissions have their own approval tabs
    // (see useMappingSubmissions.ts / useMapathonSubmissions.ts) -- excluded
    // here so they don't also show up in the general Project & Impact queue.
    const result = await apiOrToast(
      api.get<{ data: ServiceLogApiRow[]; total: number }>(
        `/service-logs?status=pending&activityTypeExcludes=map&page=${page}&limit=${SUBMISSIONS_PAGE_SIZE}`
      ),
      'Loading submissions',
      { data: [], total: 0 }
    );

    setTotal(result.total);
    setSubmissions(result.data.map((row) => {
      const display = resolveDisplay(row);
      return { ...row, displayName: display.name, displayChapter: display.chapter };
    }));
    setLoading(false);

    // If an approve/reject emptied the last item on a page past the
    // first, drop back a page instead of showing a dead-end empty page.
    if (result.data.length === 0 && page > 1) {
      setPage((p) => Math.max(1, p - 1));
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  // New submissions land here from the member-facing app in real time, so
  // the pending queue shouldn't need a manual refresh to show them.
  useServiceLogsRealtime(load);

  async function updateSubmissionStatus(logId: string, newStatus: 'approved' | 'rejected') {
    const ok = await mutateOrToast(api.patch(`/service-logs/${logId}`, { status: newStatus }), 'Updating submission');
    if (!ok) { return; }

    await load();
    onMutated();
  }

  return { submissions, loading, page, setPage, total, pageSize: SUBMISSIONS_PAGE_SIZE, updateSubmissionStatus };
}
