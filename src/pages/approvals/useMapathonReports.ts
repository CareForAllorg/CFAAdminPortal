import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast } from '../../lib/apiClient';

export interface MapathonReportRow {
  id: string;
  hostName: string;
  chapterName: string;
  eventDate: string;
  setting: string;
  participants: number;
  buildingsMapped: number | null;
  kmRoadsMapped: number | null;
  notes: string | null;
  proofPath: string | null;
  createdAt: string;
}

// Read-only -- "how many mapathons are hosted" per the requirements, not
// an approval queue. See api/_handlers/mapathonReports.ts.
export function useMapathonReports() {
  const [reports, setReports] = useState<MapathonReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiOrToast(api.get<{ data: MapathonReportRow[] }>('/mapathon-reports'), 'Loading mapathon reports', { data: [] });
    setReports(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { reports, loading, total: reports.length, reload: load };
}
