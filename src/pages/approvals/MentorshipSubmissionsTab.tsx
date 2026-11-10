import { useState } from 'react';
import { Card } from '../../components/Card';
import { IconButton } from '../../components/IconButton';
import { Modal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { MemberProfileModal } from '../../components/MemberProfileModal';
import { formatDate } from '../../utils/formatDate';
import { formatHours } from '../../utils/formatHours';
import { api } from '../../lib/apiClient';
import { useMentorshipSubmissions, type MentorshipSubmissionRow } from './useMentorshipSubmissions';
import { ProofPhoto } from './ProofPhoto';

interface MentorshipSubmissionsTabProps {
  onMutated: () => void;
}

async function viewStencilFile(path: string) {
  const result = await api.get<{ url: string }>(`/uploads/signed-url?filePath=${encodeURIComponent(path)}`);
  if (result.url) { window.open(result.url, '_blank', 'noopener,noreferrer'); }
}

export function MentorshipSubmissionsTab({ onMutated }: MentorshipSubmissionsTabProps) {
  const { submissions, page, setPage, total, pageSize, updateSubmissionStatus } = useMentorshipSubmissions(onMutated);
  const [previewRow, setPreviewRow] = useState<MentorshipSubmissionRow | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const stencils = previewRow?.verification_details?.stencils
    ? Object.entries(previewRow.verification_details.stencils)
    : [];

  return (
    <Card>
      <div className="text-[14px] font-bold text-text mb-4 flex items-center gap-2">
        <i className="ti ti-heart-handshake text-muted text-[17px]" /> Pending Mentorship Submissions
      </div>
      <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1.3fr] gap-[10px] items-center py-3 border-b border-border [&>div]:text-[11px] [&>div]:font-bold [&>div]:text-muted [&>div]:uppercase [&>div]:tracking-[0.05em]">
        <div>Mentor</div>
        <div>Activity</div>
        <div>Date</div>
        <div>Hours</div>
        <div>Action</div>
      </div>

      {submissions.length === 0 ? (
        <div className="text-center py-6 text-muted text-[13px]">No pending mentorship submissions.</div>
      ) : (
        submissions.map((row) => (
          <div key={row.id} className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1.3fr] gap-[10px] items-center py-3 border-b border-border last:border-b-0">
            <div
              onClick={row.user_id ? () => setSelectedProfileId(row.user_id) : undefined}
              className={row.user_id ? 'cursor-pointer' : ''}
            >
              <div className={`text-[13px] font-semibold text-text ${row.user_id ? 'hover:underline' : ''}`}>{row.displayName}</div>
              <div className="text-[11.5px] text-muted">{row.displayChapter}</div>
            </div>
            <div className="text-[11.5px] text-muted">{row.activity_type || '-'}</div>
            <div className="text-[11.5px] text-muted">{formatDate(row.submitted_at, '')}</div>
            <div className="font-semibold">{formatHours(row.hours)}</div>
            <div className="flex gap-[6px]">
              <IconButton icon="check" variant="approve" aria-label="Approve" onClick={() => updateSubmissionStatus(row.id, 'approved')} />
              <IconButton icon="x" variant="reject" aria-label="Reject" onClick={() => updateSubmissionStatus(row.id, 'rejected')} />
              <IconButton icon="eye" variant="neutral" aria-label="Preview" onClick={() => setPreviewRow(row)} />
            </div>
          </div>
        ))
      )}

      {submissions.length > 0 ? (
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
      ) : null}

      <Modal open={previewRow !== null} onClose={() => setPreviewRow(null)} title="Submission Preview" subtitle={previewRow?.name ?? ''}>
        {previewRow ? (
          <>
            <div className="flex flex-col gap-[3px] py-[11px] border-b border-border">
              <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">Activity Type</div>
              <div className="text-[14px] text-text font-semibold">{previewRow.activity_type || '-'}</div>
            </div>
            {previewRow.verification_details?.category ? (
              <div className="flex flex-col gap-[3px] py-[11px] border-b border-border">
                <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">Health Category</div>
                <div className="text-[14px] text-text font-semibold">{previewRow.verification_details.category}</div>
              </div>
            ) : null}
            <div className="flex flex-col gap-[3px] py-[11px] border-b border-border">
              <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">Hours</div>
              <div className="text-[14px] text-text font-semibold">{formatHours(previewRow.hours)}</div>
            </div>
            <div className="flex flex-col gap-[3px] py-[11px] border-b border-border">
              <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">Submitted</div>
              <div className="text-[14px] text-text font-semibold">{formatDate(previewRow.submitted_at, '')}</div>
            </div>
            {previewRow.proof_path ? (
              <div className="flex flex-col gap-[3px] py-[11px] border-b border-border">
                <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">Proof</div>
                <div className="mt-[4px]"><ProofPhoto path={previewRow.proof_path} /></div>
              </div>
            ) : null}
            {stencils.length > 0 ? (
              <div className="flex flex-col gap-[6px] py-[11px] border-b border-border">
                <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">Completed Stencils</div>
                <div className="flex flex-col gap-[6px] mt-[4px]">
                  {stencils.map(([key, file]) => (
                    <button
                      key={key}
                      onClick={() => viewStencilFile(file.path)}
                      className="text-left text-[12.5px] font-bold text-brand bg-none border-none cursor-pointer font-sans hover:underline flex items-center gap-[6px]"
                    >
                      <i className="ti ti-file-text" /> {file.name || key}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-[3px] py-[11px] last:border-b-0">
              <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">Description</div>
              <div className="text-[14px] text-text font-normal">{previewRow.description || '-'}</div>
            </div>
          </>
        ) : null}
      </Modal>

      <MemberProfileModal profileId={selectedProfileId} onClose={() => setSelectedProfileId(null)} />
    </Card>
  );
}
