import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';

export interface Partner {
  id: string;
  name: string;
  website: string | null;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
}

export type PartnerPayload = Partial<Omit<Partner, 'id' | 'created_at'>>;

export function usePartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiOrToast(api.get<{ data: Partner[] }>('/partners'), 'Loading partners', { data: [] });
    setPartners(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createPartner(payload: PartnerPayload) {
    const ok = await mutateOrToast(api.post('/partners', payload), 'Adding partner');
    if (ok) { await load(); }
    return ok;
  }

  async function updatePartner(id: string, payload: PartnerPayload) {
    const ok = await mutateOrToast(api.patch(`/partners/${id}`, payload), 'Updating partner');
    if (ok) { await load(); }
    return ok;
  }

  async function deletePartner(id: string) {
    const ok = await mutateOrToast(api.delete(`/partners/${id}`), 'Deleting partner');
    if (ok) { await load(); }
    return ok;
  }

  return { partners, loading, createPartner, updatePartner, deletePartner, reload: load };
}
