import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import type { Resource } from '../../types/database';

interface ResourceEditModalProps {
  item: Resource | null;
  onClose: () => void;
  onSave: (id: string, payload: Partial<Resource>) => Promise<boolean>;
}

const AUDIENCES = ['All Members', 'Chapter Leads', 'Chapter Members', 'Independent Members'];
const VIDEO_ROLES = ['chapter_lead', 'chapter_member', 'independent_member'];

const inputClass = 'w-full px-[13px] py-[9px] border border-border rounded-lg text-[13px] text-text bg-bg outline-none font-sans transition-colors duration-150 focus:border-brand focus:bg-white';
const labelClass = 'block text-[11px] font-bold text-muted uppercase tracking-[0.05em] mb-[6px]';

export function ResourceEditModal({ item, onClose, onSave }: ResourceEditModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [audience, setAudience] = useState(AUDIENCES[0]);
  const [featured, setFeatured] = useState(false);
  const [videoRole, setVideoRole] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(item?.title ?? '');
    setDescription(item?.description ?? '');
    setLink(item?.link ?? '');
    setAudience(item?.audience ?? AUDIENCES[0]);
    setFeatured(item?.featured ?? false);
    setVideoRole(item?.video_role ?? '');
  }, [item]);

  async function handleSave() {
    if (!item) { return; }
    setSaving(true);
    const ok = await onSave(item.id, {
      title: title.trim(),
      description: description.trim() || null,
      link: link.trim() || null,
      audience,
      featured,
      video_role: item.category === 'Videos' && videoRole ? videoRole : null,
    });
    setSaving(false);
    if (ok) { onClose(); }
  }

  return (
    <Modal open={item !== null} onClose={onClose} title="Edit Resource" subtitle={item?.title}>
      <div className="flex flex-col gap-[14px]">
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
          <label className={labelClass}>Audience</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className={inputClass}>
            {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {item?.category === 'Videos' ? (
          <div>
            <label className={labelClass}>Onboarding Video For Role <span className="normal-case font-normal text-muted">(optional)</span></label>
            <select value={videoRole} onChange={(e) => setVideoRole(e.target.value)} className={inputClass}>
              <option value="">Not an onboarding video</option>
              {VIDEO_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        ) : null}
        <label className="flex items-center gap-[8px] text-[13px] text-text cursor-pointer">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Featured (highlighted card on the member portal)
        </label>
        <Button variant="primary" onClick={handleSave} disabled={saving || !title.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Modal>
  );
}
