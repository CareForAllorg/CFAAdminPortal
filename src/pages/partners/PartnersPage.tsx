import { useState } from 'react';
import { Topbar } from '../../components/Topbar';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { SearchBar } from '../../components/SearchBar';
import { ConfirmModal } from '../../components/ConfirmModal';
import { formatDate } from '../../utils/formatDate';
import { usePartners, partnerContactName, type Partner } from './usePartners';
import { PartnerEditModal } from './PartnerEditModal';
import { useChapterApplications } from '../chapters/useChapterApplications';

export function PartnersPage() {
  const { partners, createPartner, updatePartner, deletePartner } = usePartners();
  // Program partners created through the Volunteer Portal's Partner With
  // Us flow are real chapters rows under the hood (see
  // app/onboarding/actions.ts), tagged meta.is_partner -- reusing the same
  // hook/actions Chapter Applications already has, rather than a second
  // copy of pending-review logic, so approving/rejecting here and there
  // can never drift out of sync.
  const { applications, approve: approveApplication, reject: rejectApplication } = useChapterApplications();
  const pendingPartnerApplications = applications.filter((a) => a.meta.is_partner);
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState<Partner | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Partner | null>(null);

  const query = search.trim().toLowerCase();
  const visible = partners.filter((p) => p.name.toLowerCase().includes(query));

  async function handleConfirmDelete() {
    if (!deleteItem) { return; }
    await deletePartner(deleteItem.id);
    setDeleteItem(null);
  }

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Topbar title="Program Partners" />
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <i className="ti ti-plus text-[13px] mr-1" />Add Partner
        </Button>
      </div>
      <div className="text-[12.5px] text-muted -mt-[10px]">
        Add and maintain partners here manually, or approve/reject organizations that sign up as a Program Partner through the Volunteer Portal below -- a program partner is a chapter under the hood (also visible in Chapters &gt; Chapter Applications), just without the Check-Ins tab. Shows up in the Admin Overview's Chapters &amp; Partners leaderboard.
      </div>

      {pendingPartnerApplications.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] font-bold text-text flex items-center gap-2">
              <i className="ti ti-clock text-muted text-[17px]" /> Pending Applications
              <span className="inline-flex items-center px-[9px] py-[2px] rounded-full text-[11px] font-bold bg-warning-light text-warning-dark">{pendingPartnerApplications.length}</span>
            </div>
          </div>
          {pendingPartnerApplications.map((app) => (
            <div key={app.id} className="flex items-center justify-between gap-3 py-[14px] border-b border-border last:border-b-0">
              <div>
                <div className="text-[13px] font-semibold text-text">{app.name}</div>
                <div className="text-[11.5px] text-muted mt-px">
                  {[app.meta.applicant_name, app.meta.applicant_email].filter(Boolean).join(' — ')}
                  {app.meta.application_city ? ` · ${app.meta.application_city}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-[13px] flex-shrink-0">
                <button onClick={() => approveApplication(app.id)} className="text-[12.5px] font-bold text-success-dark bg-none border-none cursor-pointer font-sans hover:underline">Approve</button>
                <button onClick={() => rejectApplication(app.id)} className="text-[12.5px] font-bold text-accent bg-none border-none cursor-pointer font-sans hover:underline">Reject</button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[14px] font-bold text-text flex items-center gap-2">
            <i className="ti ti-handshake text-muted text-[17px]" /> All Partners
          </div>
          <SearchBar value={search} onChange={setSearch} placeholder="Search partners..." className="w-[220px]" />
        </div>

        <div className="grid grid-cols-[1.4fr_1.2fr_1.2fr_0.9fr_0.7fr] gap-3 items-center py-[14px] border-b border-border [&>div]:text-[11px] [&>div]:font-bold [&>div]:text-muted [&>div]:uppercase [&>div]:tracking-[0.05em]">
          <div>Organization</div>
          <div>Contact</div>
          <div>Website</div>
          <div>Added</div>
          <div>Actions</div>
        </div>

        {visible.length === 0 ? (
          <div className="text-center py-6 text-muted text-[13px]">{partners.length === 0 ? 'No partners added yet.' : 'No matches found.'}</div>
        ) : visible.map((p) => (
          <div key={p.id} className="grid grid-cols-[1.4fr_1.2fr_1.2fr_0.9fr_0.7fr] gap-3 items-center py-[14px] border-b border-border last:border-b-0">
            <div>
              <div className="text-[13px] font-semibold text-text">{p.name}</div>
              {p.notes ? <div className="text-[11.5px] text-muted mt-px">{p.notes}</div> : null}
            </div>
            <div className="text-[11.5px] text-muted">
              {partnerContactName(p) || p.contact_email ? (
                <>
                  {partnerContactName(p) ? <div>{partnerContactName(p)}</div> : null}
                  {p.contact_email ? <div>{p.contact_email}</div> : null}
                </>
              ) : '-'}
            </div>
            <div className="text-[11.5px] text-muted">
              {p.website ? (
                <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{p.website}</a>
              ) : '-'}
            </div>
            <div className="text-[11.5px] text-muted">{formatDate(p.created_at)}</div>
            <div className="flex items-center gap-[13px]">
              <button onClick={() => setEditItem(p)} className="text-[12.5px] font-bold text-brand bg-none border-none cursor-pointer font-sans hover:underline">Edit</button>
              <button onClick={() => setDeleteItem(p)} className="text-[12.5px] font-bold text-accent bg-none border-none cursor-pointer font-sans hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </Card>

      <PartnerEditModal open={editItem !== null} item={editItem} onClose={() => setEditItem(null)} onSave={(payload) => updatePartner(editItem!.id, payload)} />
      <PartnerEditModal open={addOpen} item={null} onClose={() => setAddOpen(false)} onSave={createPartner} />
      <ConfirmModal
        open={deleteItem !== null}
        title="Delete partner?"
        text={`Are you sure you want to permanently delete "${deleteItem?.name ?? ''}"? This can't be undone.`}
        onCancel={() => setDeleteItem(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
