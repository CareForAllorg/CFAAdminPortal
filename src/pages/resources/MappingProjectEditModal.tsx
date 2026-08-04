import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import type { MappingProject, MappingProjectPayload } from './useMappingProjects';

interface MappingProjectEditModalProps {
  open: boolean;
  item: MappingProject | null;
  onClose: () => void;
  onSave: (payload: MappingProjectPayload) => Promise<boolean>;
}

const TYPE_OPTIONS = ['Buildings', 'Roads', 'Waterways'];
const MAPPING_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const inputClass = 'w-full px-[13px] py-[9px] border border-border rounded-lg text-[13px] text-text bg-bg outline-none font-sans transition-colors duration-150 focus:border-brand focus:bg-white';
const labelClass = 'block text-[11px] font-bold text-muted uppercase tracking-[0.05em] mb-[6px]';

export function MappingProjectEditModal({ open, item, onClose, onSave }: MappingProjectEditModalProps) {
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState('#245EC2');
  const [mappingLevel, setMappingLevel] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRegion(item?.region ?? '');
    setCountry(item?.country ?? '');
    setDescription(item?.description ?? '');
    setUrl(item?.url ?? '');
    setColor(item?.color ?? '#245EC2');
    setMappingLevel(item?.mapping_level ?? '');
    setTypes(item?.types ?? []);
  }, [item, open]);

  function toggleType(t: string) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handleSave() {
    setSaving(true);
    const ok = await onSave({
      region: region.trim(),
      country: country.trim(),
      description: description.trim(),
      url: url.trim() || null,
      color,
      mapping_level: mappingLevel || null,
      types,
    });
    setSaving(false);
    if (ok) { onClose(); }
  }

  const valid = region.trim() && country.trim() && description.trim();

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit Mapping Task' : 'New Mapping Task'} subtitle={item?.country}>
      <div className="flex flex-col gap-[14px]">
        <div>
          <label className={labelClass}>Project Title</label>
          <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Syria" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Region</label>
          <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Middle East & North Africa" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Mapping Level</label>
          <select value={mappingLevel} onChange={(e) => setMappingLevel(e.target.value)} className={inputClass}>
            <option value="">Not set</option>
            {MAPPING_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Project Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Project Link</label>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tasks.hotosm.org/projects/..." className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Data Types</label>
          <div className="flex gap-[10px] flex-wrap">
            {TYPE_OPTIONS.map((t) => (
              <label key={t} className="flex items-center gap-[6px] text-[12.5px] text-text cursor-pointer">
                <input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} />
                {t}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Accent Color</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 border border-border rounded-lg cursor-pointer bg-bg" />
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving || !valid}>
          {saving ? 'Saving…' : item ? 'Save Changes' : 'Create Task'}
        </Button>
      </div>
    </Modal>
  );
}
