import { useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { StatusPill } from '../../components/StatusPill';
import { ConfirmModal } from '../../components/ConfirmModal';
import { formatDate } from '../../utils/formatDate';
import type { ChapterApplication } from './useChapterApplications';

interface ChapterApplicationsProps {
  applications: ChapterApplication[];
  loading: boolean;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) { return null; }
  return (
    <div>
      <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.05em] mb-[2px]">{label}</div>
      <div className="text-[12.5px] text-text leading-[1.5]">{value}</div>
    </div>
  );
}

export function ChapterApplications({ applications, loading, onApprove, onReject }: ChapterApplicationsProps) {
  const [rejectTarget, setRejectTarget] = useState<ChapterApplication | null>(null);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[14px] font-bold text-text flex items-center gap-2">
          <i className="ti ti-clipboard-list text-muted text-[17px]" /> Chapter Applications
        </div>
        {applications.length > 0 && <StatusPill variant="warning">{applications.length} pending</StatusPill>}
      </div>
      <div className="text-[12.5px] text-muted mb-[18px] leading-[1.5]">
        New chapters are already accessible to their lead upon submission -- approving here only controls whether a chapter is publicly visible and joinable by other members.
      </div>

      {loading ? (
        <div className="text-center py-5 text-muted text-[13px]">Loading...</div>
      ) : applications.length === 0 ? (
        <div className="text-center py-5 text-muted text-[13px]">No pending applications.</div>
      ) : (
        <div className="flex flex-col gap-[14px]">
          {applications.map((app) => {
            const m = app.meta;
            const location = [m.application_city, m.application_state || m.application_country].filter(Boolean).join(', ');
            return (
              <div key={app.id} className="border border-border rounded-[10px] p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-[14px] font-bold text-text">{app.name}</div>
                    <div className="text-[11.5px] text-muted mt-[2px]">
                      Applied {formatDate(m.applied_at || app.createdAt)}
                      {m.chapter_type ? ` · ${m.chapter_type === 'school' ? 'School-based' : 'Community-based'}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" className="!px-4 !py-[7px] !text-[12px]" onClick={() => setRejectTarget(app)}>Reject</Button>
                    <Button variant="primary" className="!px-4 !py-[7px] !text-[12px]" onClick={() => onApprove(app.id)}>Approve</Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Field label="Applicant" value={[m.applicant_name, m.applicant_email].filter(Boolean).join(' — ')} />
                  <Field label="School / Community" value={m.application_school_name} />
                  <Field label="Location" value={location || undefined} />
                  <Field label="Co-Founder" value={m.application_cofounder === 'yes' ? (m.application_cofounder_info || 'Yes') : undefined} />
                  <Field label="Additional Member" value={m.application_additional_member_info} />
                  <Field label="Advisor" value={m.application_advisor_info} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!rejectTarget}
        title="Reject Chapter Application"
        text={`Reject "${rejectTarget?.name}"? Its lead will keep chapter_lead access to their Chapter Hub, but the chapter will stay hidden from the public directory.`}
        onCancel={() => setRejectTarget(null)}
        onConfirm={async () => {
          if (rejectTarget) { await onReject(rejectTarget.id); }
          setRejectTarget(null);
        }}
      />
    </Card>
  );
}
