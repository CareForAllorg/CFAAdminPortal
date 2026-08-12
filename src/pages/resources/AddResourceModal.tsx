import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { SegmentedToggle } from '../../components/SegmentedToggle';
import type { Resource } from '../../types/database';

interface AddResourceModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: Partial<Resource>) => Promise<boolean>;
}

const CATEGORIES: Resource['category'][] = ['Handbooks', 'Toolkits', 'Videos', 'Other'];
const SOURCE_TYPES = ['Google Doc', 'Google Slides', 'External Link', 'Template', 'Video'];
const AUDIENCES = ['All Members', 'Chapter Leads', 'Chapter Members', 'Independent Members'];

const inputClass = 'w-full px-[13px] py-[9px] border border-border rounded-lg text-[13px] text-text bg-bg outline-none font-sans transition-colors duration-150 focus:border-brand focus:bg-white';
const labelClass = 'block text-[11px] font-bold text-muted uppercase tracking-[0.05em] mb-[6px]';

export function AddResourceModal({ open, onClose, onCreate }: AddResourceModalProps) {
  const [category, setCategory] = useState<Resource['category']>('Handbooks');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [sourceType, setSourceType] = useState(SOURCE_TYPES[0]);
  const [duration, setDuration] = useState('');
  const [audience, setAudience] = useState(AUDIENCES[0]);
  const [status, setStatus] = useState<'published' | 'coming-soon'>('published');
  const [saving, setSaving] = useState(false);

  function reset() {
    setCategory('Handbooks');
    setTitle('');
    setDescription('');
    setLink('');
    setSourceType(SOURCE_TYPES[0]);
    setDuration('');
    setAudience(AUDIENCES[0]);
    setStatus('published');
  }

  async function handleCreate() {
    setSaving(true);
    const ok = await onCreate({
      category,
      title: title.trim(),
      description: description.trim() || null,
      link: link.trim() || null,
      source_type: sourceType,
      duration: category === 'Videos' ? (duration.trim() || null) : null,
      audience,
      status,
    });
    setSaving(false);
    if (ok) {
      reset();
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Resource">
      <div className="flex flex-col gap-[14px]">
        <div>
          <label className={labelClass}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as Resource['category'])} className={inputClass}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Link</label>
          <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Source Type</label>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={inputClass}>
            {SOURCE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {category === 'Videos' ? (
          <div>
            <label className={labelClass}>Duration</label>
            <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 2 min" className={inputClass} />
          </div>
        ) : null}
        <div>
          <label className={labelClass}>Audience</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className={inputClass}>
            {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <SegmentedToggle
            options={[{ value: 'published', label: 'Published' }, { value: 'coming-soon', label: 'Coming Soon' }]}
            value={status}
            onChange={setStatus}
          />
        </div>
        <Button variant="primary" onClick={handleCreate} disabled={saving || !title.trim()}>
          {saving ? 'Adding…' : 'Add Resource'}
        </Button>
      </div>
    </Modal>
  );
}
