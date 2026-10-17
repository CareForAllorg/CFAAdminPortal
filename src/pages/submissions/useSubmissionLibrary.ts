import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiOrToast } from '../../lib/apiClient';
import { resolveDisplay, type EmbeddedProfile } from '../approvals/shared';

export type FolderId = 'workshop' | 'infographic' | 'resource' | 'letter' | 'project-photos' | 'mapping-proof';

export interface FolderDef {
  id: FolderId;
  label: string;
  icon: string;
  kind: 'file' | 'photo';
  blurb: string;
}

// One folder per kind of thing a member can submit. The four stencils live
// inside a single curriculum service_logs row (verification_details.stencils)
// so each stencil type gets its own folder; photos come from the one
// proof_path every other submission can carry.
export const FOLDERS: FolderDef[] = [
  { id: 'workshop', label: 'Workshop Slide Sprint', icon: 'presentation', kind: 'file', blurb: 'Curriculum stencil PDFs' },
  { id: 'infographic', label: 'Infographic Jam', icon: 'chart-infographic', kind: 'file', blurb: 'Curriculum stencil PDFs' },
  { id: 'resource', label: 'Resource Roundup', icon: 'list-details', kind: 'file', blurb: 'Curriculum stencil PDFs' },
  { id: 'letter', label: 'Letter to Leader', icon: 'mail', kind: 'file', blurb: 'Curriculum stencil PDFs' },
  { id: 'project-photos', label: 'Project & Impact Photos', icon: 'photo', kind: 'photo', blurb: 'Photos from project and impact-hour entries' },
  { id: 'mapping-proof', label: 'Mapping & Mapathon Screenshots', icon: 'map', kind: 'photo', blurb: 'HOTOSM contribution screenshots' },
];

const FOLDER_LABEL: Record<string, string> = Object.fromEntries(FOLDERS.map((f) => [f.id, f.label]));
const STENCIL_KEYS = ['workshop', 'infographic', 'resource', 'letter'] as const;

export interface SubmissionFile {
  key: string;
  folder: FolderId;
  label: string;
  path: string;
  fileName: string;
  isPdf: boolean;
}

// One service_logs row, whole. A curriculum submission holds all four of a
// mentor's stencils at once, so files are grouped here per submission and
// the folders are just a view across them.
export interface LibrarySubmission {
  logId: string;
  displayName: string;
  displayChapter: string;
  submitted_at: string;
  reviewed_at: string | null;
  status: 'pending' | 'approved' | 'rejected';
  activityType: string;
  hours: number;
  orgName: string | null;
  verifyMethod: string | null;
  category: string | null;
  description: string | null;
  primaryImpact: { label: string; magnitude: number | null } | null;
  secondaryImpact: { label: string; magnitude: number | null } | null;
  extraDetails: { label: string; value: string }[];
  files: SubmissionFile[];
}

export interface LibraryItem {
  key: string;
  file: SubmissionFile;
  submission: LibrarySubmission;
}

interface ServiceLogApiRow {
  id: string;
  name: string | null;
  org_name: string | null;
  activity_type: string;
  hours: number;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at: string | null;
  description: string | null;
  verify_method: string | null;
  proof_path: string | null;
  verification_details: unknown;
  primary_impact: string | null;
  impact_magnitude: number | null;
  secondary_impact: string | null;
  secondary_impact_magnitude: number | null;
  profiles: EmbeddedProfile | null;
}

function isPdf(path: string): boolean {
  return path.toLowerCase().endsWith('.pdf');
}

function humanize(key: string): string {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseDetails(details: unknown) {
  const d = (details && typeof details === 'object' && !Array.isArray(details) ? details : {}) as Record<string, unknown>;
  const stencils = (d.stencils && typeof d.stencils === 'object' ? d.stencils : {}) as Record<string, { path?: unknown; name?: unknown } | null>;
  const category = typeof d.category === 'string' && d.category ? d.category : null;

  // Everything else in verification_details (other than the two keys this
  // page already presents specially) is surfaced as plain label/value
  // rows, so a field added to the wizard later still shows up here.
  const extraDetails: { label: string; value: string }[] = [];
  Object.entries(d).forEach(([key, value]) => {
    if (key === 'category' || key === 'stencils' || value == null || value === '') { return; }
    extraDetails.push({ label: humanize(key), value: typeof value === 'object' ? JSON.stringify(value) : String(value) });
  });

  return { category, stencils, extraDetails };
}

function impactOf(label: string | null, magnitude: number | null) {
  return label ? { label, magnitude } : null;
}

// Every submission that carries a file, across ALL statuses -- the whole
// point is that approving something shouldn't make its files (or the
// answers that came with them) vanish, which is what happens if the only
// place to see them is the approval queues.
export function useSubmissionLibrary() {
  const [submissions, setSubmissions] = useState<LibrarySubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [curriculum, proofs] = await Promise.all([
      apiOrToast(
        api.get<{ data: ServiceLogApiRow[] }>('/service-logs?activityTypeContains=curriculum'),
        'Loading curriculum stencils',
        { data: [] }
      ),
      apiOrToast(
        api.get<{ data: ServiceLogApiRow[] }>('/service-logs?hasProof=true'),
        'Loading submission photos',
        { data: [] }
      ),
    ]);

    const byId = new Map<string, LibrarySubmission>();

    function base(row: ServiceLogApiRow): LibrarySubmission {
      const display = resolveDisplay(row);
      return {
        logId: row.id,
        displayName: display.name,
        displayChapter: display.chapter,
        submitted_at: row.submitted_at,
        reviewed_at: row.reviewed_at,
        status: row.status,
        activityType: row.activity_type,
        hours: row.hours,
        orgName: row.org_name,
        verifyMethod: row.verify_method,
        category: null,
        description: row.description,
        primaryImpact: impactOf(row.primary_impact, row.impact_magnitude),
        secondaryImpact: impactOf(row.secondary_impact, row.secondary_impact_magnitude),
        extraDetails: [],
        files: [],
      };
    }

    curriculum.data.forEach((row) => {
      const sub = base(row);
      const { category, stencils, extraDetails } = parseDetails(row.verification_details);
      sub.category = category;
      sub.extraDetails = extraDetails;
      STENCIL_KEYS.forEach((key) => {
        const entry = stencils[key];
        if (!entry || typeof entry.path !== 'string' || !entry.path) { return; }
        sub.files.push({
          key,
          folder: key,
          label: FOLDER_LABEL[key],
          path: entry.path,
          fileName: typeof entry.name === 'string' && entry.name ? entry.name : entry.path.split('/').pop() || 'stencil.pdf',
          isPdf: isPdf(entry.path),
        });
      });
      byId.set(row.id, sub);
    });

    proofs.data.forEach((row) => {
      if (!row.proof_path) { return; }
      // Curriculum rows are already filed under their stencil folders.
      if ((row.activity_type || '').toLowerCase().includes('curriculum')) { return; }
      const sub = byId.get(row.id) ?? base(row);
      const isMapping = (row.activity_type || '').toLowerCase().includes('map');
      sub.files.push({
        key: 'proof',
        folder: isMapping ? 'mapping-proof' : 'project-photos',
        label: isMapping ? 'Contribution screenshot' : 'Photo',
        path: row.proof_path,
        fileName: row.proof_path.split('/').pop() || 'proof',
        isPdf: isPdf(row.proof_path),
      });
      byId.set(row.id, sub);
    });

    setSubmissions(
      Array.from(byId.values())
        .filter((s) => s.files.length > 0)
        .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // The flat per-file view the folders render: one item per file, each
  // pointing back at its whole submission.
  const items = useMemo<LibraryItem[]>(
    () => submissions.flatMap((submission) => submission.files.map((file) => ({ key: `${submission.logId}:${file.key}`, file, submission }))),
    [submissions]
  );

  return { items, submissions, loading, reload: load };
}
