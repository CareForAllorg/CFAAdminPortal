import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import type { MentorProfileOption } from './useMentors';

interface AddMentorModalProps {
  open: boolean;
  profiles: MentorProfileOption[];
  onClose: () => void;
  onAdd: (profileId: string) => Promise<boolean>;
}

const inputClass = 'w-full px-[13px] py-[9px] border border-border rounded-lg text-[13px] text-text bg-bg outline-none font-sans transition-colors duration-150 focus:border-brand focus:bg-white';
const labelClass = 'block text-[11px] font-bold text-muted uppercase tracking-[0.05em] mb-[6px]';

export function AddMentorModal({ open, profiles, onClose, onAdd }: AddMentorModalProps) {
  const [profileId, setProfileId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProfileId(profiles[0]?.id ?? '');
  }, [profiles, open]);

  async function handleAdd() {
    if (!profileId) { return; }
    setSaving(true);
    const ok = await onAdd(profileId);
    setSaving(false);
    if (ok) { onClose(); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Mentor" subtitle="Pick a member whose profile role is Mentor.">
      <div className="flex flex-col gap-[14px]">
        {profiles.length === 0 ? (
          <div className="text-[13px] text-muted">
            Every mentor-role profile already has a booking-availability entry.
          </div>
        ) : (
          <div>
            <label className={labelClass}>Mentor</label>
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className={inputClass}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unnamed'}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button variant="primary" onClick={handleAdd} disabled={saving || !profileId}>
          {saving ? 'Adding…' : 'Add Mentor'}
        </Button>
      </div>
    </Modal>
  );
}
