import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Topbar } from '../../components/Topbar';
import { Card } from '../../components/Card';
import { Modal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { SearchBar } from '../../components/SearchBar';
import { StatusPill } from '../../components/StatusPill';
import { formatDate } from '../../utils/formatDate';
import { ProofPhoto, downloadProofPhoto, viewProofPhoto } from '../approvals/ProofPhoto';
import {
  FOLDERS, useSubmissionLibrary,
  type FolderDef, type FolderId, type LibraryItem, type LibrarySubmission, type SubmissionFile,
} from './useSubmissionLibrary';

const STATUS_VARIANT = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
} as const;

const linkButtonClass = 'text-[12.5px] font-bold text-brand bg-none border-none cursor-pointer font-sans hover:underline disabled:opacity-50';
const labelClass = 'text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]';
const PAGE_SIZE = 12;

// "Other: <what they typed>" is one category value -- filter on the part
// before the colon so every custom topic lands in one bucket.
function categoryGroup(category: string): string {
  return category.split(':')[0].trim();
}

function useFileActions(file: SubmissionFile) {
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.error('Could not open file', { description: 'Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }
  return {
    busy,
    view: () => run(() => viewProofPhoto(file.path)),
    download: () => run(() => downloadProofPhoto(file.path, file.fileName)),
  };
}

function Meta({ submission }: { submission: LibrarySubmission }) {
  return (
    <>
      <div className="text-[13px] font-bold text-text truncate">{submission.displayName}</div>
      <div className="text-[11.5px] text-muted truncate">
        {submission.displayChapter !== '-' ? `${submission.displayChapter} · ` : ''}{formatDate(submission.submitted_at, '—')}
      </div>
    </>
  );
}

function FileRow({ item, onOpen }: { item: LibraryItem; onOpen: () => void }) {
  const { busy, view, download } = useFileActions(item.file);
  const { submission } = item;
  return (
    <div className="border border-border rounded-xl px-5 py-[14px] cursor-pointer hover:border-brand transition-colors duration-150" onClick={onOpen}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-[10px] min-w-0">
          <i className="ti ti-file-type-pdf text-[22px] text-accent shrink-0 mt-px" />
          <div className="min-w-0">
            <Meta submission={submission} />
            <div className="text-[11.5px] text-muted truncate mt-[2px]">{item.file.fileName}</div>
          </div>
        </div>
        <div className="flex items-center gap-[14px] shrink-0" onClick={(e) => e.stopPropagation()}>
          <StatusPill variant={STATUS_VARIANT[submission.status]}>{submission.status}</StatusPill>
          <button className={linkButtonClass} disabled={busy} onClick={view}>View</button>
          <button className={linkButtonClass} disabled={busy} onClick={download}>Download</button>
        </div>
      </div>
      {submission.category ? (
        <div className="mt-[8px]">
          <span className="text-[10.5px] font-bold px-[10px] py-[3px] rounded-full uppercase tracking-[0.03em] bg-hover-tint text-brand">{submission.category}</span>
        </div>
      ) : null}
      <div className="text-[13px] text-text leading-[1.5] mt-[8px] line-clamp-2">
        {submission.description || <span className="text-muted">No description provided.</span>}
      </div>
      <div className="text-[11.5px] font-bold text-brand mt-[8px]">
        Open full submission{submission.files.length > 1 ? ` (${submission.files.length} files)` : ''} →
      </div>
    </div>
  );
}

function PhotoTile({ item, onOpen }: { item: LibraryItem; onOpen: () => void }) {
  const { busy, download } = useFileActions(item.file);
  const { submission } = item;
  return (
    <div className="border border-border rounded-[10px] p-[10px] flex flex-col gap-[8px] cursor-pointer hover:border-brand transition-colors duration-150" onClick={onOpen}>
      <div className="h-[150px] rounded-lg overflow-hidden bg-bg flex items-center justify-center">
        {item.file.isPdf ? (
          <i className="ti ti-file-type-pdf text-[40px] text-accent" />
        ) : (
          <ProofPhoto path={item.file.path} linkToFullSize={false} className="h-full w-full object-cover" />
        )}
      </div>
      <div>
        <Meta submission={submission} />
        <div className="text-[11px] text-muted truncate">{submission.activityType}</div>
        <div className="text-[11.5px] text-text leading-[1.4] mt-[4px] line-clamp-2">{submission.description || ''}</div>
      </div>
      <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <StatusPill variant={STATUS_VARIANT[submission.status]}>{submission.status}</StatusPill>
        <button className={linkButtonClass} disabled={busy} onClick={download}>Download</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[3px] py-[9px] border-b border-border">
      <div className={labelClass}>{label}</div>
      <div className="text-[13.5px] text-text">{children}</div>
    </div>
  );
}

function DetailFile({ file }: { file: SubmissionFile }) {
  const { busy, view, download } = useFileActions(file);
  return (
    <div className="border border-border rounded-xl p-[12px] flex flex-col gap-[10px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-[9px] min-w-0">
          <i className={`ti ${file.isPdf ? 'ti-file-type-pdf text-accent' : 'ti-photo text-muted'} text-[20px] shrink-0`} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-text">{file.label}</div>
            <div className="text-[11.5px] text-muted truncate">{file.fileName}</div>
          </div>
        </div>
        <div className="flex items-center gap-[14px] shrink-0">
          {file.isPdf ? <button className={linkButtonClass} disabled={busy} onClick={view}>View</button> : null}
          <button className={linkButtonClass} disabled={busy} onClick={download}>Download</button>
        </div>
      </div>
      {!file.isPdf ? <ProofPhoto path={file.path} /> : null}
    </div>
  );
}

function SubmissionDetailModal({ submission, onClose }: { submission: LibrarySubmission | null; onClose: () => void }) {
  return (
    <Modal
      wide
      open={submission !== null}
      onClose={onClose}
      title={submission?.displayName ?? ''}
      subtitle={submission ? `${submission.activityType} · submitted ${formatDate(submission.submitted_at, '—')}` : undefined}
    >
      {submission ? (
        <>
          <div className="grid grid-cols-2 max-portal:grid-cols-1 gap-x-6">
            <Field label="Status"><StatusPill variant={STATUS_VARIANT[submission.status]}>{submission.status}</StatusPill></Field>
            <Field label="Chapter / Organization">
              {submission.displayChapter !== '-' ? submission.displayChapter : '-'}
              {submission.orgName && submission.orgName !== submission.displayChapter ? ` · ${submission.orgName}` : ''}
            </Field>
            <Field label="Hours">{submission.hours}</Field>
            <Field label="Reviewed">{submission.reviewed_at ? formatDate(submission.reviewed_at) : 'Not yet reviewed'}</Field>
            {submission.category ? <Field label="Category">{submission.category}</Field> : null}
            {submission.verifyMethod ? <Field label="Verification method">{submission.verifyMethod}</Field> : null}
            {submission.primaryImpact ? (
              <Field label="Primary impact">
                {submission.primaryImpact.label}{submission.primaryImpact.magnitude != null ? ` — ${submission.primaryImpact.magnitude}` : ''}
              </Field>
            ) : null}
            {submission.secondaryImpact ? (
              <Field label="Secondary impact">
                {submission.secondaryImpact.label}{submission.secondaryImpact.magnitude != null ? ` — ${submission.secondaryImpact.magnitude}` : ''}
              </Field>
            ) : null}
            {submission.extraDetails.map((d) => <Field key={d.label} label={d.label}>{d.value}</Field>)}
          </div>

          <Field label="Description">
            <span className="whitespace-pre-wrap leading-[1.55]">{submission.description || <span className="text-muted">No description provided.</span>}</span>
          </Field>

          <div className={`${labelClass} mt-[16px] mb-[10px]`}>Files in this submission ({submission.files.length})</div>
          <div className="flex flex-col gap-[10px]">
            {submission.files.map((file) => <DetailFile key={file.key} file={file} />)}
          </div>
        </>
      ) : null}
    </Modal>
  );
}

function FolderView({ folder, items, onBack, onOpen }: { folder: FolderDef; items: LibraryItem[]; onBack: () => void; onOpen: (s: LibrarySubmission) => void }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => (i.submission.category ? categoryGroup(i.submission.category) : '')).filter(Boolean))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(({ submission: s }) => {
      if (status !== 'all' && s.status !== status) { return false; }
      if (category !== 'all' && (!s.category || categoryGroup(s.category) !== category)) { return false; }
      if (!q) { return true; }
      return [s.displayName, s.displayChapter, s.category ?? '', s.description ?? '', s.activityType].some((v) => v.toLowerCase().includes(q));
    });
  }, [items, search, status, category]);

  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectClass = 'px-[13px] py-[9px] border border-border rounded-lg text-[13px] text-text bg-bg outline-none font-sans';

  return (
    <Card>
      <button onClick={onBack} className={`${linkButtonClass} mb-3 flex items-center gap-[5px]`}>
        <i className="ti ti-arrow-left text-[14px]" /> All folders
      </button>
      <div className="text-[15px] font-bold text-text mb-[14px] flex items-center gap-2">
        <i className={`ti ti-${folder.icon} text-muted text-[18px]`} /> {folder.label}
        <span className="text-[11px] font-bold text-muted normal-case">({filtered.length})</span>
      </div>

      <div className="flex items-center gap-[10px] flex-wrap mb-[16px]">
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search by member, chapter, or description..."
          className="flex-1 min-w-[240px]"
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectClass}>
          <option value="all">Any status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {categories.length > 0 ? (
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className={selectClass}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-6 text-muted text-[13px]">
          {items.length === 0 ? 'Nothing submitted to this folder yet.' : 'No files match your filters.'}
        </div>
      ) : folder.kind === 'photo' ? (
        <div className="grid grid-cols-4 max-portal:grid-cols-2 gap-[14px]">
          {visible.map((item) => <PhotoTile key={item.key} item={item} onOpen={() => onOpen(item.submission)} />)}
        </div>
      ) : (
        <div className="flex flex-col gap-[12px]">
          {visible.map((item) => <FileRow key={item.key} item={item} onOpen={() => onOpen(item.submission)} />)}
        </div>
      )}

      {filtered.length > 0 ? (
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      ) : null}
    </Card>
  );
}

export function SubmissionLibraryPage() {
  const { items, loading } = useSubmissionLibrary();
  const [openFolder, setOpenFolder] = useState<FolderId | null>(null);
  const [openSubmission, setOpenSubmission] = useState<LibrarySubmission | null>(null);

  const byFolder = useMemo(() => {
    const map = new Map<FolderId, LibraryItem[]>();
    FOLDERS.forEach((f) => map.set(f.id, []));
    items.forEach((i) => map.get(i.file.folder)?.push(i));
    return map;
  }, [items]);

  const folder = FOLDERS.find((f) => f.id === openFolder) ?? null;

  return (
    <>
      <Topbar title="Submission Library" />
      <div className="text-[12.5px] text-muted -mt-[10px]">
        Every submission with files, filed by type. Unlike the approval queues, files and everything the member wrote stay here after a submission is approved or rejected -- open any one to see the full record and every file in it.
      </div>

      {folder ? (
        <FolderView
          key={folder.id}
          folder={folder}
          items={byFolder.get(folder.id) ?? []}
          onBack={() => setOpenFolder(null)}
          onOpen={setOpenSubmission}
        />
      ) : (
        <div className="grid grid-cols-3 max-portal:grid-cols-2 gap-[14px]">
          {FOLDERS.map((f) => {
            const count = byFolder.get(f.id)?.length ?? 0;
            return (
              <button
                key={f.id}
                onClick={() => setOpenFolder(f.id)}
                className="bg-white border border-border rounded-xl px-5 py-[18px] text-left cursor-pointer font-sans flex items-start gap-[14px] hover:border-brand transition-colors duration-150"
              >
                <i className="ti ti-folder-filled text-[34px] text-brand shrink-0" />
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-text flex items-center gap-[7px]">
                    <i className={`ti ti-${f.icon} text-muted text-[15px]`} /> {f.label}
                  </div>
                  <div className="text-[11.5px] text-muted mt-[2px]">{f.blurb}</div>
                  <div className="text-[12.5px] font-bold text-text mt-[8px]">{loading ? '…' : `${count} file${count === 1 ? '' : 's'}`}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <SubmissionDetailModal submission={openSubmission} onClose={() => setOpenSubmission(null)} />
    </>
  );
}
