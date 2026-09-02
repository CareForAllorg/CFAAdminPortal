import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { api, apiOrToast } from '../lib/apiClient';
import { formatDate } from '../utils/formatDate';
import { partnerContactName } from '../pages/partners/usePartners';

interface PartnerProfile {
  id: string;
  name: string;
  website: string | null;
  contact_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
}

interface PartnerProfileModalProps {
  partnerId: string | null;
  onClose: () => void;
}

const NOT_SPECIFIED = 'Not specified';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[3px] py-[11px] border-b border-border last:border-b-0">
      <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">{label}</div>
      <div className="text-[14px] text-text font-semibold">{children}</div>
    </div>
  );
}

export function PartnerProfileModal({ partnerId, onClose }: PartnerProfileModalProps) {
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!partnerId) { setProfile(null); return; }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const result = await apiOrToast(api.get<{ data: PartnerProfile }>(`/partners/${partnerId}`), 'Loading partner profile', null);
      if (!cancelled) {
        setProfile(result?.data ?? null);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [partnerId]);

  return (
    <Modal open={partnerId !== null} onClose={onClose} title="Partner Profile" subtitle={profile?.name}>
      {loading || !profile ? (
        <div className="text-center py-6 text-muted text-[13px]">{loading ? 'Loading…' : 'Could not load this partner.'}</div>
      ) : (
        <>
          <Field label="Website">
            {profile.website ? (
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{profile.website}</a>
            ) : NOT_SPECIFIED}
          </Field>
          <Field label="Contact">{partnerContactName(profile) || profile.contact_email ? [partnerContactName(profile), profile.contact_email].filter(Boolean).join(' — ') : NOT_SPECIFIED}</Field>
          <Field label="Added">{formatDate(profile.created_at, '')}</Field>
          <Field label="Notes">{profile.notes || NOT_SPECIFIED}</Field>
        </>
      )}
    </Modal>
  );
}
