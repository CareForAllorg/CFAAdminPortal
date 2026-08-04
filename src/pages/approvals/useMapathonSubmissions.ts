import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';
import { useServiceLogsRealtime } from '../../lib/useServiceLogsRealtime';
import { resolveDisplay, type EmbeddedProfile } from './shared';

export interface MapathonSubmissionRow {
  id: string;
  user_id: string | null;
  activity_type: string;
  hours: number;
  submitted_at: string;
  description: string | null;
  displayName: string;
  displayChapter: string;
  tasksCompleted: number | null;
  proofPath: string | null;
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
  impact_magnitude: number | null;
  proof_path: string | null;
  profiles: EmbeddedProfile | null;
}

export const MAPATHON_SUBMISSIONS_PAGE_SIZE = 20;

// Mapathon time logs (an individual logging their own hours for attending a
// mapathon) -- distinct from mapathon_reports (a chapter lead's "I hosted
// this event" record, see useMapathonReports.ts). "mapathon" doesn't
// overlap with any other activity_type substring, so this can filter
// server-side unlike Mapping Submissions, which has to exclude "mapathon"
// out of the broader "map" match client-side.
export function useMapathonSubmissions(onMutated: () => void) {
  const [allRows, setAllRows] = useState<MapathonSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiOrToast(
      api.get<{ data: ServiceLogApiRow[] }>('/service-logs?status=pending&activityTypeContains=mapathon'),
      'Loading mapathon submissions',
      { data: [] }
    );

    setAllRows(result.data.map((row) => {
      const display = resolveDisplay(row);
      return {
        id: row.id,
        user_id: row.user_id,
        activity_type: row.activity_type,
        hours: row.hours,
        submitted_at: row.submitted_at,
        description: row.description,
        displayName: display.name,
        displayChapter: display.chapter,
        tasksCompleted: row.impact_magnitude,
        proofPath: row.proof_path,
      };
    }));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useServiceLogsRealtime(load);

  const total = allRows.length;
  const from = (page - 1) * MAPATHON_SUBMISSIONS_PAGE_SIZE;
  const submissions = allRows.slice(from, from + MAPATHON_SUBMISSIONS_PAGE_SIZE);

  async function updateSubmissionStatus(logId: string, newStatus: 'approved' | 'rejected') {
    const ok = await mutateOrToast(api.patch(`/service-logs/${logId}`, { status: newStatus }), 'Updating submission');
    if (!ok) { return; }

    await load();
    onMutated();
  }

  return { submissions, loading, page, setPage, total, pageSize: MAPATHON_SUBMISSIONS_PAGE_SIZE, updateSubmissionStatus };
}
