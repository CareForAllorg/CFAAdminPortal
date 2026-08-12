import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import type { MentorWithAvatar } from './useMentors';

interface MentorEditModalProps {
  item: MentorWithAvatar | null;
  onClose: () => void;
  onSave: (id: string, payload: { name: string; calendly_link: string | null }) => Promise<boolean>;
  onUploadAvatar: (mentorId: string, profileId: string, file: File) => Promise<string | null>;
  onRemoveAvatar: (mentorId: string, profileId: string) => Promise<boolean>;
}

const inputClass = 'w-full px-[13px] py-[9px] border border-border rounded-lg text-[13px] text-text bg-bg outline-none font-sans transition-colors duration-150 focus:border-brand focus:bg-white';
const labelClass = 'block text-[11px] font-bold text-muted uppercase tracking-[0.05em] mb-[6px]';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function MentorEditModal({ item, onClose, onSave, onUploadAvatar, onRemoveAvatar }: MentorEditModalProps) {
  const [name, setName] = useState('');
  const [calendlyLink, setCalendlyLink] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(item?.name ?? '');
    setCalendlyLink(item?.calendly_link ?? '');
    setAvatarUrl(item?.avatar_url ?? null);
  }, [item]);

  async function handleSave() {
    if (!item) { return; }
    setSaving(true);
    const ok = await onSave(item.id, { name: name.trim(), calendly_link: calendlyLink.trim() || null });
    setSaving(false);
    if (ok) { onClose(); }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !item) { return; }

    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Photo too large', { description: 'Please choose an image 2MB or smaller.' });
      return;
    }

    setUploading(true);
    const url = await onUploadAvatar(item.id, item.profile_id, file);
    setUploading(false);
    if (url) { setAvatarUrl(url); }
  }

  async function handleRemove() {
    if (!item) { return; }
    setRemoving(true);
    const ok = await onRemoveAvatar(item.id, item.profile_id);
    setRemoving(false);
    if (ok) { setAvatarUrl(null); }
  }

  return (
    <Modal open={item !== null} onClose={onClose} title="Edit Mentor" subtitle={item?.name}>
      <div className="flex flex-col gap-[14px]">
        <div className="flex items-center gap-[14px]">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name || 'Mentor'} className="w-[56px] h-[56px] rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-[56px] h-[56px] rounded-full bg-bg border border-border shrink-0" />
          )}
          <div className="flex items-center gap-[10px]">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFileChange} className="hidden" />
            <Button variant="outline" className="!text-[12px] !px-4 !py-2" onClick={() => fileInputRef.current?.click()} disabled={uploading || removing}>
              {uploading ? 'Uploading…' : 'Upload Photo'}
            </Button>
            {avatarUrl ? (
              <button
                onClick={handleRemove}
                disabled={uploading || removing}
                className="text-[12px] font-bold text-accent bg-none border-none cursor-pointer font-sans hover:underline disabled:opacity-40"
              >
                {removing ? 'Removing…' : 'Remove Photo'}
              </button>
            ) : null}
          </div>
        </div>
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
