import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';

export interface MapathonDate {
  id: string;
  event_date: string;
  hours: number;
  label: string | null;
  created_at: string;
}

export type MapathonDatePayload = Partial<Omit<MapathonDate, 'id' | 'created_at'>>;

// Backs the member-facing app's Mapathon Time Log "when was the mapathon"
// dropdown (VolunteerPortalCFA's GET /api/mapping/mapathon-dates) -- adding
// a date here makes it immediately selectable there, no deploy needed.
export function useMapathonDates() {
  const [dates, setDates] = useState<MapathonDate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiOrToast(api.get<{ data: MapathonDate[] }>('/mapathon-dates'), 'Loading mapathon dates', { data: [] });
    setDates(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createDate(payload: MapathonDatePayload) {
    const ok = await mutateOrToast(api.post('/mapathon-dates', payload), 'Adding mapathon date');
    if (ok) { await load(); }
    return ok;
  }

  async function updateDate(id: string, payload: MapathonDatePayload) {
    const ok = await mutateOrToast(api.patch(`/mapathon-dates/${id}`, payload), 'Updating mapathon date');
    if (ok) { await load(); }
    return ok;
  }

  async function deleteDate(id: string) {
    const ok = await mutateOrToast(api.delete(`/mapathon-dates/${id}`), 'Deleting mapathon date');
    if (ok) { await load(); }
    return ok;
  }

  return { dates, loading, createDate, updateDate, deleteDate, reload: load };
}
