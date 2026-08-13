import { useEffect, useState } from 'react';
import { api, apiOrToast } from '../../lib/apiClient';

interface OverviewStats {
  chapterCount: number | null;
  memberCount: number | null;
  newMemberCount: number | null;
  nonCompliantCount: number | null;
}

interface OverviewStatsResponse {
  chapterCount: number;
  memberCount: number;
  newMemberCount: number;
  nonCompliantCount: number;
}

export function useOverviewStats() {
  const [stats, setStats] = useState<OverviewStats>({ chapterCount: null, memberCount: null, newMemberCount: null, nonCompliantCount: null });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await apiOrToast(
        api.get<OverviewStatsResponse>('/overview/stats'),
        'Loading overview stats',
        null
      );
      if (!cancelled && result) {
        setStats({
          chapterCount: result.chapterCount,
          memberCount: result.memberCount,
          newMemberCount: result.newMemberCount,
          nonCompliantCount: result.nonCompliantCount,
        });
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return stats;
}
