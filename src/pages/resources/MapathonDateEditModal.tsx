import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { MAX_ATTENDANCE_BYTES, type MapathonDate, type MapathonDatePayload } from './useMapathonDates';

interface MapathonDateEditModalProps {
  open: boolean;
  item: MapathonDate | null;
  onClose: () => void;
  onSave: (payload: MapathonDatePayload) => Promise<boolean>;
  onUploadAttendance: (dateId: string, file: File) => Promise<{ path: string; attendeeCount: number } | null>;
}

const inputClass = 'w-full px-[13px] py-[9px] border border-border rounded-lg text-[13px] text-text bg-bg outline-none font-sans transition-colors duration-150 focus:border-brand focus:bg-white';
const labelClass = 'block text-[11px] font-bold text-muted uppercase tracking-[0.05em] mb-[6px]';

export function MapathonDateEditModal({ open, item, onClose, onSave, onUploadAttendance }: MapathonDateEditModalProps) {
  const [eventDate, setEventDate] = useState('');
  const [hours, setHours] = useState('');
  const [label, setLabel] = useState('');
  const [totalBuildings, setTotalBuildings] = useState('0');
  const [totalKm, setTotalKm] = useState('0');
  const [bonusHours, setBonusHours] = useState('0');
  const [attendancePath, setAttendancePath] = useState<string | null>(null);
  const [attendeeCount, setAttendeeCount] = useState<number | null>(null);
  const [attendanceFileName, setAttendanceFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEventDate(item?.event_date ?? '');
    setHours(item ? String(item.hours) : '');
    setLabel(item?.label ?? '');
    setTotalBuildings(item ? String(item.total_buildings_mapped) : '0');
    setTotalKm(item ? String(item.total_km_roads_mapped) : '0');
    setBonusHours(item ? String(item.bonus_service_hours) : '0');
    setAttendancePath(item?.attendance_list_path ?? null);
    setAttendeeCount(null);
    setAttendanceFileName(null);
  }, [item, open]);

  async function handleSave() {
    const stats: Array<[string, string]> = [
      ['Buildings Mapped', totalBuildings],
      ['Roads (km)', totalKm],
      ['Bonus Hours', bonusHours],
    ];
    const negative = stats.find(([, value]) => value !== '' && Number(value) < 0);
    if (negative) {
      toast.error(`${negative[0]} can't be negative`, { description: 'Published totals must be 0 or greater.' });
      return;
    }

    const payload: MapathonDatePayload = {
      event_date: eventDate,
      hours: Number(hours),
      label: label.trim() || null,
      total_buildings_mapped: Number(totalBuildings || 0),
      total_km_roads_mapped: Number(totalKm || 0),
      bonus_service_hours: Number(bonusHours || 0),
    };
    // A new date has no id yet, so the upload widget is disabled for it --
    // only carry the attendance path through on edits (null clears it).
    if (item) { payload.attendance_list_path = attendancePath; }

    setSaving(true);
    const ok = await onSave(payload);
    setSaving(false);
    if (ok) { onClose(); }
  }

  async function handleAttendanceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !item) { return; }

    if (file.size > MAX_ATTENDANCE_BYTES) {
      toast.error('File too large', { description: 'Please choose a CSV 5MB or smaller.' });
      return;
    }
    if (!['text/csv', 'application/csv'].includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Not a CSV', { description: 'Please choose a .csv attendance list.' });
      return;
    }

    setUploading(true);
    const result = await onUploadAttendance(item.id, file);
    setUploading(false);
    if (result) {
      setAttendancePath(result.path);
      setAttendeeCount(result.attendeeCount);
      setAttendanceFileName(file.name);
    }
  }

  function handleRemoveAttendance() {
    setAttendancePath(null);
    setAttendeeCount(null);
    setAttendanceFileName(null);
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

        <div className="border-t border-border pt-[14px]">
          <div className="text-[11px] font-bold text-muted uppercase tracking-[0.05em] mb-[6px]">Published Totals</div>
          <div className="text-[11.5px] text-muted mb-[12px]">Self-reported totals -- these get added on top of member submissions on the Impact Measurables.</div>
          <div className="grid grid-cols-3 gap-[10px]">
            <div>
              <label className={labelClass}>Buildings Mapped</label>
              <input type="number" min="0" step="1" value={totalBuildings} onChange={(e) => setTotalBuildings(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Roads (km)</label>
              <input type="number" min="0" step="0.1" value={totalKm} onChange={(e) => setTotalKm(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Bonus Hours</label>
              <input type="number" min="0" step="0.25" value={bonusHours} onChange={(e) => setBonusHours(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-[14px]">
          <label className={labelClass}>Attendance List</label>
          <div className="flex items-center gap-[10px] flex-wrap">
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleAttendanceFile} className="hidden" />
            <Button variant="outline" className="!text-[12px] !px-4 !py-2" onClick={() => fileInputRef.current?.click()} disabled={!item || uploading}>
              {uploading ? 'Uploading…' : attendancePath ? 'Replace List' : 'Upload List'}
            </Button>
            {attendancePath ? (
              <>
                <span className="text-[12px] text-muted">
                  {attendanceFileName ?? 'Attendance list attached'}
                  {attendeeCount != null ? ` — ${attendeeCount} attendee${attendeeCount === 1 ? '' : 's'}` : ''}
                </span>
                <button
                  onClick={handleRemoveAttendance}
                  disabled={uploading}
                  className="text-[12px] font-bold text-accent bg-none border-none cursor-pointer font-sans hover:underline disabled:opacity-40"
                >
                  Remove
                </button>
              </>
            ) : null}
          </div>
          {!item ? (
            <div className="text-[11.5px] text-muted mt-[8px]">Save the date first, then upload the attendance list from this date's row.</div>
          ) : (
            <div className="text-[11.5px] text-muted mt-[8px]">Upload the sign-in CSV (name/email). It's stored privately and read via a signed link on the published results.</div>
          )}
        </div>

        <Button variant="primary" onClick={handleSave} disabled={saving || !valid}>
          {saving ? 'Saving…' : item ? 'Save Changes' : 'Add Date'}
        </Button>
      </div>
    </Modal>
  );
}
