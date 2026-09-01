import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';
import { resolveDisplay, type EmbeddedProfile } from './shared';

export interface VerificationRow {
  id: string;
  hours: number;
  verify_method: string | null;
  verification_completed: boolean;
  verification_completed_at: string | null;
  verification_details: Record<string, string> | null;
  displayName: string;
  displayChapter: string;
  state: 'complete' | 'incomplete';
  userId: string | null;
}

interface ServiceLogApiRow {
  id: string;
  name: string | null;
  org_name: string | null;
  hours: number;
  verify_method: string | null;
  verification_completed: boolean;
  verification_completed_at: string | null;
  verification_details: Record<string, string> | null;
  profiles: EmbeddedProfile | null;
}

export function useVerifications(onMutated: () => void) {
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await apiOrToast(
      api.get<{ data: ServiceLogApiRow[] }>('/service-logs?hasVerifyMethod=true'),
      'Loading verification requests',
      { data: [] }
    );

    setVerifications(result.data.map((row) => {
      const display = resolveDisplay(row);
      return {
        ...row,
        displayName: display.name,
        displayChapter: display.chapter,
        state: row.verification_completed ? 'complete' : 'incomplete',
        userId: row.profiles?.id ?? null,
      };
    }));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleVerification(logId: string, currentlyComplete: boolean) {
    const newValue = !currentlyComplete;

    const ok = await mutateOrToast(
      api.patch(`/service-logs/${logId}`, { verification_completed: newValue }),
      'Updating verification status'
    );
    if (!ok) { return; }

    await load();
    onMutated();
  }

  return { verifications, loading, toggleVerification };
}
