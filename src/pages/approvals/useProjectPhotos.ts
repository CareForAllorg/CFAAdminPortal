import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast } from '../../lib/apiClient';
import { resolveDisplay, type EmbeddedProfile } from './shared';

export interface ProjectPhotoRow {
  id: string;
  activity_type: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  description: string | null;
  proof_path: string;
  displayName: string;
  displayChapter: string;
}

interface ServiceLogApiRow {
  id: string;
  name: string | null;
  org_name: string | null;
  activity_type: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  description: string | null;
  proof_path: string | null;
  profiles: EmbeddedProfile | null;
}

export const PROJECT_PHOTOS_PAGE_SIZE = 24;

// Every project/impact-hour submission that ever included a proof photo,
// across all statuses (not just pending) -- so an admin looking for
// social-media-worthy photos doesn't have to hunt through each approved
// submission individually, and photos aren't effectively lost the moment
// their submission leaves the pending queue. Same "not Mapping/Mapathon"
// scope as the Project & Impact Hour Submissions tab (those have their own
// gallery-worthy photos too, but a member's HOTOSM proof screenshot isn't
// a "photo" in the social-media sense this is for).
export function useProjectPhotos() {
  const [allRows, setAllRows] = useState<ProjectPhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiOrToast(
      api.get<{ data: ServiceLogApiRow[] }>('/service-logs?activityTypeExcludes=map&hasProof=true'),
      'Loading project photos',
      { data: [] }
    );

    setAllRows(
      result.data
        .filter((row): row is ServiceLogApiRow & { proof_path: string } => !!row.proof_path)
        .map((row) => {
          const display = resolveDisplay(row);
          return {
            id: row.id,
            activity_type: row.activity_type,
            status: row.status,
            submitted_at: row.submitted_at,
            description: row.description,
            proof_path: row.proof_path,
            displayName: display.name,
            displayChapter: display.chapter,
          };
        })
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = allRows.length;
  const from = (page - 1) * PROJECT_PHOTOS_PAGE_SIZE;
  const photos = allRows.slice(from, from + PROJECT_PHOTOS_PAGE_SIZE);

  return { photos, loading, page, setPage, total, pageSize: PROJECT_PHOTOS_PAGE_SIZE };
}
