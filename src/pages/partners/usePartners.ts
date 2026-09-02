import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';

export interface Partner {
  id: string;
  name: string;
  website: string | null;
  // Legacy free-text field -- kept for partners saved before the
  // first/last split, displayed as a fallback when the new fields are
  // empty. New saves always write first/last instead.
  contact_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
}

export type PartnerPayload = Partial<Omit<Partner, 'id' | 'created_at'>>;

// Prefers the split first/last fields; falls back to the legacy
// contact_name for partners that haven't been re-saved since the split.
export function partnerContactName(p: Pick<Partner, 'contact_name' | 'contact_first_name' | 'contact_last_name'>): string | null {
  const split = [p.contact_first_name, p.contact_last_name].filter(Boolean).join(' ').trim();
  return split || p.contact_name;
}

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
