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
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(item?.name ?? '');
    setWebsite(item?.website ?? '');
    // Falls back to splitting the legacy single contact_name field on the
    // first space only when this partner hasn't been re-saved with the
    // split fields yet -- same pattern used elsewhere for this kind of
    // one-time field migration.
    if (item?.contact_first_name || item?.contact_last_name) {
      setContactFirstName(item?.contact_first_name ?? '');
      setContactLastName(item?.contact_last_name ?? '');
    } else if (item?.contact_name) {
      const [first, ...rest] = item.contact_name.trim().split(' ');
      setContactFirstName(first ?? '');
      setContactLastName(rest.join(' '));
    } else {
      setContactFirstName('');
      setContactLastName('');
    }
    setContactEmail(item?.contact_email ?? '');
    setNotes(item?.notes ?? '');
  }, [item, open]);

  async function handleSave() {
    setSaving(true);
    const ok = await onSave({
      name: name.trim(),
      website: website.trim() || null,
      contact_first_name: contactFirstName.trim() || null,
      contact_last_name: contactLastName.trim() || null,
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
        <div className="grid grid-cols-2 gap-[14px]">
          <div>
            <label className={labelClass}>Contact First Name</label>
            <input type="text" value={contactFirstName} onChange={(e) => setContactFirstName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Contact Last Name</label>
            <input type="text" value={contactLastName} onChange={(e) => setContactLastName(e.target.value)} className={inputClass} />
          </div>
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
