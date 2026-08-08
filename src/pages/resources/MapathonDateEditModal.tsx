import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import type { MapathonDate, MapathonDatePayload } from './useMapathonDates';

interface MapathonDateEditModalProps {
  open: boolean;
  item: MapathonDate | null;
  onClose: () => void;
  onSave: (payload: MapathonDatePayload) => Promise<boolean>;
}

const inputClass = 'w-full px-[13px] py-[9px] border border-border rounded-lg text-[13px] text-text bg-bg outline-none font-sans transition-colors duration-150 focus:border-brand focus:bg-white';
const labelClass = 'block text-[11px] font-bold text-muted uppercase tracking-[0.05em] mb-[6px]';

export function MapathonDateEditModal({ open, item, onClose, onSave }: MapathonDateEditModalProps) {
  const [eventDate, setEventDate] = useState('');
  const [hours, setHours] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEventDate(item?.event_date ?? '');
    setHours(item ? String(item.hours) : '');
    setLabel(item?.label ?? '');
  }, [item, open]);

  async function handleSave() {
    setSaving(true);
    const ok = await onSave({
      event_date: eventDate,
      hours: Number(hours),
      label: label.trim() || null,
    });
    setSaving(false);
    if (ok) { onClose(); }
  }

  const valid = eventDate && Number(hours) > 0;

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit Mapathon Date' : 'New Mapathon Date'} subtitle={item?.label ?? undefined}>
      <div className="flex flex-col gap-[14px]">
        <div>
          <label className={labelClass}>Date</label>
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Hours Credited</label>
          <input type="number" min="0" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 2" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Label (optional)</label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. August CFA Central Mapathon" className={inputClass} />
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving || !valid}>
          {saving ? 'Saving…' : item ? 'Save Changes' : 'Add Date'}
        </Button>
      </div>
    </Modal>
  );
}
