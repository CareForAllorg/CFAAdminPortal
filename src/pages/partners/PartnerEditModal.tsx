import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import type { Partner, PartnerPayload } from './usePartners';

interface PartnerEditModalProps {
  open: boolean;
  item: Partner | null;
  onClose: () => void;
  onSave: (payload: PartnerPayload) => Promise<boolean>;
}

const inputClass = 'w-full px-[13px] py-[9px] border border-border rounded-lg text-[13px] text-text bg-bg outline-none font-sans transition-colors duration-150 focus:border-brand focus:bg-white';
const labelClass = 'block text-[11px] font-bold text-muted uppercase tracking-[0.05em] mb-[6px]';

export function PartnerEditModal({ open, item, onClose, onSave }: PartnerEditModalProps) {
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(item?.name ?? '');
    setWebsite(item?.website ?? '');
    setContactName(item?.contact_name ?? '');
    setContactEmail(item?.contact_email ?? '');
    setNotes(item?.notes ?? '');
  }, [item, open]);

  async function handleSave() {
    setSaving(true);
    const ok = await onSave({
      name: name.trim(),
      website: website.trim() || null,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (ok) { onClose(); }
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit Partner' : 'Add Partner'} subtitle={item?.name}>
      <div className="flex flex-col gap-[14px]">
        <div>
          <label className={labelClass}>Organization Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Website</label>
          <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Contact Name</label>
          <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Contact Email</label>
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} />
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : item ? 'Save Changes' : 'Add Partner'}
        </Button>
      </div>
    </Modal>
  );
}
