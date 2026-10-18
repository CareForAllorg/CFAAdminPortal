import { useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import type { Resource } from '../../types/database';

// The three guides mentors see, one slot each. They're ordinary `resources`
// rows (category 'Mentor Guides', audience 'Mentors') matched to a slot by
// title, so the member portal reads them from the same table as every
// other resource -- these buttons just create/update that row through the
// existing /resources API.
export const MENTOR_GUIDES = [
  { title: 'Impact Hour Guide', icon: 'clock-check', blurb: 'How mentors log and run impact hours' },
  { title: 'Check-In Guide', icon: 'clipboard-check', blurb: 'How mentors run quarterly chapter check-ins' },
  { title: 'Office Hour Guide', icon: 'calendar-event', blurb: 'How mentors hold office hours' },
] as const;

const inputClass = 'w-full px-[13px] py-[9px] border border-border rounded-lg text-[13px] text-text bg-bg outline-none font-sans transition-colors duration-150 focus:border-brand focus:bg-white';
const labelClass = 'block text-[11px] font-bold text-muted uppercase tracking-[0.05em] mb-[6px]';

interface MentorGuidesCardProps {
  guides: Resource[];
  onCreate: (payload: Partial<Resource>) => Promise<boolean>;
  onUpdate: (id: string, payload: Partial<Resource>) => Promise<boolean>;
}

export function MentorGuidesCard({ guides, onCreate, onUpdate }: MentorGuidesCardProps) {
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const findGuide = (title: string) => guides.find((g) => g.title.trim().toLowerCase() === title.toLowerCase());
  const editing = editingTitle ? findGuide(editingTitle) : undefined;

  function openEditor(title: string) {
    const existing = findGuide(title);
    setLink(existing?.link ?? '');
    setDescription(existing?.description ?? '');
    setEditingTitle(title);
  }

  async function handleSave() {
    if (!editingTitle) { return; }
    setSaving(true);
    const payload = { link: link.trim() || null, description: description.trim() || null, status: 'published' as const };
    const ok = editing
      ? await onUpdate(editing.id, payload)
      : await onCreate({ ...payload, title: editingTitle, category: 'Mentor Guides', audience: 'Mentors', source_type: 'External Link' });
    setSaving(false);
    if (ok) { setEditingTitle(null); }
  }

  return (
    <Card>
      <div className="font-heading text-[16px] text-text tracking-[0.01em] mb-[6px] flex items-center gap-[9px]">
        <i className="ti ti-school" /> Mentor Guides
      </div>
      <div className="text-[12.5px] text-muted mb-[16px]">
        The guides mentors see in their portal. Set each guide's link (a Google Doc, PDF, or any page) and it shows up for mentors.
      </div>

      <div className="grid grid-cols-3 max-portal:grid-cols-1 gap-[14px]">
        {MENTOR_GUIDES.map((g) => {
          const existing = findGuide(g.title);
          const hasLink = !!existing?.link;
          return (
            <div key={g.title} className="border border-border rounded-xl px-5 py-[18px] flex flex-col gap-[10px]">
              <div className="flex items-center gap-[10px]">
                <i className={`ti ti-${g.icon} text-[24px] text-brand`} />
                <div>
                  <div className="text-[14px] font-bold text-text">{g.title}</div>
                  <div className="text-[11.5px] text-muted">{g.blurb}</div>
                </div>
              </div>
              <div className={`text-[11.5px] font-bold ${hasLink ? 'text-success-dark' : 'text-muted'}`}>
                {hasLink ? 'Link set' : 'Not set up yet'}
              </div>
              <div className="flex items-center gap-[10px] mt-auto">
                {hasLink ? (
                  <Button
                    variant="outline"
                    className="!text-[12px] !px-4 !py-2"
                    onClick={() => window.open(existing!.link as string, '_blank', 'noopener,noreferrer')}
                  >
                    Open Guide
                  </Button>
                ) : null}
                <Button variant="primary" className="!text-[12px] !px-4 !py-2" onClick={() => openEditor(g.title)}>
                  {hasLink ? 'Edit Link' : 'Set Up Guide'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={editingTitle !== null} onClose={() => setEditingTitle(null)} title={editingTitle ?? ''} subtitle="Mentor guide">
        <div className="flex flex-col gap-[14px]">
          <div>
            <label className={labelClass}>Guide Link</label>
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
          </div>
          <Button variant="primary" onClick={handleSave} disabled={saving || !link.trim()}>
            {saving ? 'Saving…' : 'Save Guide'}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
