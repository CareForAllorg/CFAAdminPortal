import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { api, apiOrToast } from '../lib/apiClient';
import { formatDate } from '../utils/formatDate';

interface ChapterLead {
  name: string;
  email: string | null;
}

interface ChapterMeta {
  meeting_day?: string;
  meeting_time?: string;
  meeting_location?: string;
  meeting_link?: string;
  discord?: string;
  groupme?: string;
  whatsapp?: string;
  instagram?: string;
  tiktok?: string;
  twitter?: string;
  advisor_name?: string;
  advisor_email?: string;
}

interface ChapterProfile {
  id: string;
  name: string;
  created_at: string;
  status: string;
  meta: ChapterMeta | null;
  leads: ChapterLead[];
  memberCount: number;
}

interface ChapterProfileModalProps {
  chapterId: string | null;
  onClose: () => void;
}

const NOT_SPECIFIED = 'Not specified';

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-[3px] py-[11px] border-b border-border last:border-b-0">
      <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">{label}</div>
      <div className="text-[14px] text-text font-semibold">{value || NOT_SPECIFIED}</div>
    </div>
  );
}

// Deliberately omits LinkedIn -- per the requirements, Chapter Profile
// shouldn't surface it even though chapters.meta.linkedin exists as a
// field on the member-facing app's Admin & Settings tab.
export function ChapterProfileModal({ chapterId, onClose }: ChapterProfileModalProps) {
  const [profile, setProfile] = useState<ChapterProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!chapterId) { setProfile(null); return; }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const result = await apiOrToast(api.get<{ data: ChapterProfile }>(`/chapters/${chapterId}`), 'Loading chapter profile', null);
      if (!cancelled) {
        setProfile(result?.data ?? null);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [chapterId]);

  const meta = profile?.meta ?? {};
  const socials = [meta.discord && `Discord: ${meta.discord}`, meta.groupme && `GroupMe: ${meta.groupme}`, meta.whatsapp && `WhatsApp: ${meta.whatsapp}`, meta.instagram && `Instagram: ${meta.instagram}`, meta.tiktok && `TikTok: ${meta.tiktok}`, meta.twitter && `Twitter/X: ${meta.twitter}`].filter(Boolean).join('  ·  ');
  const meeting = [meta.meeting_day, meta.meeting_time, meta.meeting_location].filter(Boolean).join(' · ');

  return (
    <Modal open={chapterId !== null} onClose={onClose} title="Chapter Profile" subtitle={profile?.name}>
      {loading || !profile ? (
        <div className="text-center py-6 text-muted text-[13px]">{loading ? 'Loading…' : 'Could not load this chapter.'}</div>
      ) : (
        <>
          <Field label="Status" value={profile.status === 'active' ? 'Active' : profile.status === 'pending' ? 'Pending Review' : 'Rejected'} />
          <Field label="Members" value={String(profile.memberCount)} />
          <Field label="Created" value={formatDate(profile.created_at, '')} />
          {profile.leads.length === 0 ? (
            <Field label="Chapter Lead" value={null} />
          ) : profile.leads.map((lead, i) => (
            <Field key={i} label={profile.leads.length > 1 ? `Chapter Lead ${i + 1}` : 'Chapter Lead'} value={lead.email ? `${lead.name} (${lead.email})` : lead.name} />
          ))}
          <Field label="Advisor" value={meta.advisor_name ? (meta.advisor_email ? `${meta.advisor_name} (${meta.advisor_email})` : meta.advisor_name) : null} />
          <Field label="Meeting" value={meeting || null} />
          <Field label="Social" value={socials || null} />
        </>
      )}
    </Modal>
  );
}
