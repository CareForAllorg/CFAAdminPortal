import { useState } from 'react';
import { Card } from '../../components/Card';
import { FilterChips } from '../../components/FilterChips';
import { SearchBar } from '../../components/SearchBar';
import { MemberProfileModal } from '../../components/MemberProfileModal';
import { formatDate } from '../../utils/formatDate';
import { formatHours } from '../../utils/formatHours';
import { useVerifications } from './useVerifications';
import { ProofDownloadButton } from './ProofPhoto';

// Keys match SubmissionDetails in the member-side form
// (app/portal/service-hours/page.tsx) -- human labels for whichever of
// these actually came through on a given request (most are only relevant
// to one verification method, so a given request only ever has a few).
// The *FilePath keys are rendered separately below as download buttons
// (paired with their *FileName sibling), not as plain text here.
const DETAIL_LABELS: Record<string, string> = {
  schoolName: 'School Name',
  deadline: 'Submission Deadline',
  portalLink: 'Submission Portal Link',
  submissionInstructions: 'Submission Instructions',
  supervisorName: 'Supervisor Name',
  supervisorEmail: 'Supervisor Email',
  addresseeName: 'Addressed To',
  addresseeOrg: 'Title / Organization',
  docusignName: 'Name',
  docusignEmail: 'Email',
  logContactName: 'Contact Name',
  logContactInfo: 'Contact Email / Phone',
  eventName: 'Name',
  eventEmail: 'Email',
  otherName: 'Name',
  otherEmail: 'Email',
  otherInstructions: 'Instructions for CFA Team',
};

// Each uploaded-document pair from the member form: fileNameKey holds the
// display name, filePathKey the private-bucket path a signed URL is
// generated from on demand (see ProofDownloadButton).
const UPLOADED_DOCUMENTS: { fileNameKey: string; filePathKey: string; label: string }[] = [
  { fileNameKey: 'docusignFileName', filePathKey: 'docusignFilePath', label: 'Uploaded Document' },
  { fileNameKey: 'logFileName', filePathKey: 'logFilePath', label: 'Uploaded Log Sheet' },
  { fileNameKey: 'otherFileName', filePathKey: 'otherFilePath', label: 'Uploaded Document' },
];

interface VerificationTabProps {
  onMutated: () => void;
}

// "Overdue" is a real filter option, but nothing in the schema currently
// produces that state (verification_completed is only ever true/false) --
// preserved as-is from the vanilla app rather than "fixed", since that
// would require new schema columns (deadline tracking) out of this
// rewrite's scope.
type VerifFilter = 'incomplete' | 'overdue' | 'all';

export function VerificationTab({ onMutated }: VerificationTabProps) {
  const { verifications, toggleVerification } = useVerifications(onMutated);
  const [filter, setFilter] = useState<VerifFilter>('incomplete');
  const [search, setSearch] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const visible = verifications.filter((v) => {
    const matchesFilter = filter === 'all' || v.state === filter;
    const matchesSearch = query === '' || v.displayName.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-[6px] flex-wrap gap-[10px]">
        <div className="text-[14px] font-bold text-text flex items-center gap-2">
          <i className="ti ti-file-certificate text-muted text-[17px]" /> Service Hour Verification Requests
        </div>
        <FilterChips
          options={[{ value: 'incomplete', label: 'Incomplete' }, { value: 'overdue', label: 'Overdue' }, { value: 'all', label: 'All' }]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <div className="text-[12.5px] text-muted mb-[14px] leading-[1.5]">
        Each request below was submitted through the member-side verification form. Review the submission portal link and method, complete verification on your end, then mark it done. Completed requests move to the All tab automatically.
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search by member name..." className="mb-[18px]" />

      {verifications.length === 0 ? (
        <div className="text-center py-6 text-muted text-[13px]">No verification requests.</div>
      ) : (
        visible.map((v) => (
          <div key={v.id} className="bg-bg border border-border rounded-xl px-5 py-[18px] mb-[14px] last:mb-0">
            <div className="flex items-start justify-between gap-[14px] mb-[13px]">
              <div
                onClick={v.userId ? () => setSelectedProfileId(v.userId) : undefined}
                className={v.userId ? 'cursor-pointer' : ''}
              >
                <div className={`text-[14px] font-semibold text-text ${v.userId ? 'hover:underline' : ''}`}>{v.displayName}</div>
                <div className="text-[11.5px] text-muted mt-px">{v.displayChapter} - {formatHours(v.hours)} total</div>
              </div>
              <span className={`inline-flex items-center gap-[5px] px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.04em] ${v.state === 'complete' ? 'bg-success-light text-success-dark' : 'bg-warning-light text-warning-dark'}`}>
                {v.verification_completed ? 'Complete' : 'Incomplete'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-[10px] mb-[13px]">
              <div>
                <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.05em] mb-[3px]">Verification Method</div>
                <div className="text-[12.5px] text-text leading-[1.45]">{v.verify_method || '-'}</div>
              </div>
              {Object.entries(v.verification_details ?? {})
                .filter(([key, value]) => value && !key.endsWith('FilePath') && !key.endsWith('FileName'))
                .map(([key, value]) => (
                  <div key={key}>
                    <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.05em] mb-[3px]">{DETAIL_LABELS[key] ?? key}</div>
                    <div className="text-[12.5px] text-text leading-[1.45] whitespace-pre-wrap">{value}</div>
                  </div>
                ))}
              {UPLOADED_DOCUMENTS.filter((d) => v.verification_details?.[d.filePathKey]).map((d) => (
                <div key={d.filePathKey}>
                  <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.05em] mb-[3px]">{d.label}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] text-text truncate">{v.verification_details![d.fileNameKey] || 'Document'}</span>
                    <ProofDownloadButton path={v.verification_details![d.filePathKey]} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-[11.5px] text-muted">
                {v.verification_completed ? `Completed ${formatDate(v.verification_completed_at, '')}` : ''}
              </span>
              <button
                onClick={() => toggleVerification(v.id, v.verification_completed)}
                className={
                  v.verification_completed
                    ? 'text-[11px] px-[14px] py-[7px] rounded-lg font-bold font-sans cursor-pointer transition-colors duration-150 bg-transparent text-danger-dark border border-danger-border hover:bg-danger-light'
                    : 'text-[11px] px-[14px] py-[7px] rounded-lg font-bold font-sans cursor-pointer transition-colors duration-150 bg-brand text-white border-none hover:bg-brand-dark'
                }
              >
                {v.verification_completed ? 'Mark Incomplete' : 'Mark Complete'}
              </button>
            </div>
          </div>
        ))
      )}

      <MemberProfileModal profileId={selectedProfileId} onClose={() => setSelectedProfileId(null)} />
    </Card>
  );
}
