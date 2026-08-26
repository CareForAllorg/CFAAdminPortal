import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';
import { useServiceLogsRealtime } from '../../lib/useServiceLogsRealtime';
import { classifyActivity } from '../../utils/activityCategory';
import { resolveDisplay, type EmbeddedProfile } from './shared';

export interface MappingSubmissionRow {
  id: string;
  user_id: string | null;
  activity_type: string;
  hours: number;
  submitted_at: string;
  description: string | null;
  displayName: string;
  displayChapter: string;
  buildings: number | null;
  roadsKm: number | null;
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
  primary_impact: string | null;
  impact_magnitude: number | null;
  secondary_impact: string | null;
  secondary_impact_magnitude: number | null;
  proof_path: string | null;
  profiles: EmbeddedProfile | null;
}

export const MAPPING_SUBMISSIONS_PAGE_SIZE = 20;

function extractMappingMetrics(row: ServiceLogApiRow): { buildings: number | null; roadsKm: number | null } {
  let buildings: number | null = null;
  let roadsKm: number | null = null;

  if (row.primary_impact === 'Buildings Mapped') { buildings = row.impact_magnitude; }
  else if (row.secondary_impact === 'Buildings Mapped') { buildings = row.secondary_impact_magnitude; }

  if (row.primary_impact === 'Roads Mapped') { roadsKm = row.impact_magnitude; }
  else if (row.secondary_impact === 'Roads Mapped') { roadsKm = row.secondary_impact_magnitude; }

  return { buildings, roadsKm };
}

// "Mapping Submissions" isn't its own table -- it's pending service_logs
// whose activity_type classifies as "Mapping" (not "Mapathons", which
// shares the "map" substring but is a separate category -- see
// classifyActivity). Fetched unfiltered-by-page and paginated client-side
// after the Mapping-only filter, since a server-side page could otherwise
// return fewer rows than the limit (or a wrong total) once Mapathon rows
// get excluded.
export function useMappingSubmissions(onMutated: () => void) {
  const [allRows, setAllRows] = useState<MappingSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiOrToast(
      api.get<{ data: ServiceLogApiRow[] }>('/service-logs?status=pending&activityTypeContains=map'),
      'Loading mapping submissions',
      { data: [] }
    );

    const mappingOnly = result.data.filter((row) => classifyActivity(row.activity_type) === 'Mapping');

    setAllRows(mappingOnly.map((row) => {
      const display = resolveDisplay(row);
      const { buildings, roadsKm } = extractMappingMetrics(row);
      return {
        id: row.id,
        user_id: row.user_id,
        activity_type: row.activity_type,
        hours: row.hours,
        submitted_at: row.submitted_at,
        description: row.description,
        displayName: display.name,
        displayChapter: display.chapter,
        buildings,
        roadsKm,
        proofPath: row.proof_path,
      };
    }));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useServiceLogsRealtime(load);

  const total = allRows.length;
  const from = (page - 1) * MAPPING_SUBMISSIONS_PAGE_SIZE;
  const submissions = allRows.slice(from, from + MAPPING_SUBMISSIONS_PAGE_SIZE);

  async function updateSubmissionStatus(logId: string, newStatus: 'approved' | 'rejected') {
    const ok = await mutateOrToast(api.patch(`/service-logs/${logId}`, { status: newStatus }), 'Updating submission');
    if (!ok) { return; }

    await load();
    onMutated();
  }

  return { submissions, loading, page, setPage, total, pageSize: MAPPING_SUBMISSIONS_PAGE_SIZE, updateSubmissionStatus };
}
