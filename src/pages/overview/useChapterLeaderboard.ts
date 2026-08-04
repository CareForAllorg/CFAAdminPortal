import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast } from '../../lib/apiClient';
import { useServiceLogsRealtime } from '../../lib/useServiceLogsRealtime';

export interface ChapterLeaderboardRow {
  id: string;
  name: string;
  type: 'Chapter' | 'Partner';
  hours: number;
}

export function useChapterLeaderboard() {
  const [ranked, setRanked] = useState<ChapterLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await apiOrToast(
      api.get<{ data: ChapterLeaderboardRow[] }>('/leaderboard/chapters'),
      'Loading chapter leaderboard',
      { data: [] }
    );
    setRanked(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useServiceLogsRealtime(load);

  return { ranked, loading };
}
