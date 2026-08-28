import { useState } from 'react';
import { Card } from '../../components/Card';
import { Modal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { StatusPill } from '../../components/StatusPill';
import { formatDate } from '../../utils/formatDate';
import { useProjectPhotos, type ProjectPhotoRow } from './useProjectPhotos';
import { ProofPhoto, ProofDownloadButton, downloadProofPhoto } from './ProofPhoto';

const STATUS_VARIANT = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
} as const;

export function ProjectPhotosTab() {
  const { photos, loading, page, setPage, total, pageSize } = useProjectPhotos();
  const [previewRow, setPreviewRow] = useState<ProjectPhotoRow | null>(null);

  return (
    <Card>
      <div className="text-[14px] font-bold text-text mb-4 flex items-center gap-2">
        <i className="ti ti-photo text-muted text-[17px]" /> Project Photos
        {!loading && <span className="text-[11px] font-bold text-muted normal-case">({total})</span>}
      </div>
      <div className="text-[12.5px] text-muted mb-[18px] leading-[1.5]">
        Every proof photo submitted with a project or impact-hour entry, across all statuses -- for pulling social-media-worthy shots without hunting through each individual submission.
      </div>

      {loading ? (
        <div className="text-center py-6 text-muted text-[13px]">Loading...</div>
      ) : photos.length === 0 ? (
        <div className="text-center py-6 text-muted text-[13px]">No project photos submitted yet.</div>
      ) : (
        <div className="grid grid-cols-4 max-portal:grid-cols-2 gap-[14px]">
          {photos.map((row) => (
            <div
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => setPreviewRow(row)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setPreviewRow(row); } }}
              className="border border-border rounded-[10px] p-[10px] text-left cursor-pointer font-sans flex flex-col gap-[8px]"
            >
              <div className="relative h-[140px] rounded-lg overflow-hidden bg-bg flex items-center justify-center">
                <ProofPhoto path={row.proof_path} linkToFullSize={false} className="h-full w-full object-cover" />
                <button
                  onClick={(e) => { e.stopPropagation(); downloadProofPhoto(row.proof_path); }}
                  aria-label="Download photo"
                  className="absolute top-[6px] right-[6px] w-[26px] h-[26px] rounded-full bg-[rgba(0,0,0,0.55)] text-white border-none cursor-pointer flex items-center justify-center hover:bg-[rgba(0,0,0,0.75)]"
                >
                  <i className="ti ti-download text-[13px]" />
                </button>
              </div>
              <div>
                <div className="text-[12.5px] font-bold text-text truncate">{row.displayName}</div>
                <div className="text-[11px] text-muted truncate">{row.activity_type}</div>
                <div className="flex items-center justify-between mt-[4px]">
                  <span className="text-[10.5px] text-muted">{formatDate(row.submitted_at, '')}</span>
                  <StatusPill variant={STATUS_VARIANT[row.status]}>{row.status}</StatusPill>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 ? (
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
      ) : null}

      <Modal open={previewRow !== null} onClose={() => setPreviewRow(null)} title={previewRow?.displayName ?? ''} subtitle={previewRow?.activity_type}>
        {previewRow ? (
          <>
            <div className="mb-[8px]"><ProofPhoto path={previewRow.proof_path} /></div>
            <div className="mb-[14px]"><ProofDownloadButton path={previewRow.proof_path} /></div>
            <div className="flex flex-col gap-[3px] py-[11px] border-b border-border">
              <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">Chapter</div>
              <div className="text-[14px] text-text font-semibold">{previewRow.displayChapter || '-'}</div>
            </div>
            <div className="flex flex-col gap-[3px] py-[11px] border-b border-border">
              <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">Submitted</div>
              <div className="text-[14px] text-text font-semibold">{formatDate(previewRow.submitted_at, '')}</div>
            </div>
            <div className="flex flex-col gap-[3px] py-[11px] border-b border-border">
              <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">Status</div>
              <div className="mt-[2px]"><StatusPill variant={STATUS_VARIANT[previewRow.status]}>{previewRow.status}</StatusPill></div>
            </div>
            <div className="flex flex-col gap-[3px] py-[11px] last:border-b-0">
              <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">Description</div>
              <div className="text-[14px] text-text font-normal">{previewRow.description || '-'}</div>
            </div>
          </>
        ) : null}
      </Modal>
    </Card>
  );
}
