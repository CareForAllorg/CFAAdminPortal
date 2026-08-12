import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import type { Mentor } from '../../types/database';

interface MentorEditModalProps {
  item: Mentor | null;
  onClose: () => void;
  onSave: (id: string, payload: { name: string; calendly_link: string | null }) => Promise<boolean>;
}

const inputClass = 'w-full px-[13px] py-[9px] border border-border rounded-lg text-[13px] text-text bg-bg outline-none font-sans transition-colors duration-150 focus:border-brand focus:bg-white';
const labelClass = 'block text-[11px] font-bold text-muted uppercase tracking-[0.05em] mb-[6px]';

export function MentorEditModal({ item, onClose, onSave }: MentorEditModalProps) {
  const [name, setName] = useState('');
  const [calendlyLink, setCalendlyLink] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(item?.name ?? '');
    setCalendlyLink(item?.calendly_link ?? '');
  }, [item]);

  async function handleSave() {
    if (!item) { return; }
    setSaving(true);
    const ok = await onSave(item.id, { name: name.trim(), calendly_link: calendlyLink.trim() || null });
    setSaving(false);
    if (ok) { onClose(); }
  }

  return (
    <Modal open={item !== null} onClose={onClose} title="Edit Mentor" subtitle={item?.name}>
      <div className="flex flex-col gap-[14px]">
        <div>
          <label className={labelClass}>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Calendly Link</label>
          <input
            type="url"
            value={calendlyLink}
            onChange={(e) => setCalendlyLink(e.target.value)}
            placeholder="https://calendly.com/..."
            className={inputClass}
          />
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Modal>
  );
}
