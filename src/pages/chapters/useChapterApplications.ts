import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';

export interface ChapterApplicationMeta {
  chapter_type?: string;
  application_school_name?: string;
  application_city?: string;
  application_state?: string;
  application_country?: string;
  application_cofounder?: 'yes' | 'no';
  application_cofounder_info?: string;
  application_additional_member_info?: string;
  application_advisor_info?: string;
  applicant_name?: string;
  applicant_email?: string;
  applied_at?: string;
}

export interface ChapterApplication {
  id: string;
  name: string;
  createdAt: string;
  meta: ChapterApplicationMeta;
}

interface ChapterApiRow {
  id: string;
  name: string;
  created_at: string;
  status: string;
  meta: ChapterApplicationMeta | null;
}

// Pending chapters are just chapters with status = 'pending' -- there's no
// separate "application" table. The lead already has full chapter_lead
// access to their Chapter Hub the moment they apply (see the member-facing
// app's POST /chapters); approval here only controls whether the chapter
// shows up in the public join listing.
export function useChapterApplications() {
  const [applications, setApplications] = useState<ChapterApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiOrToast(
      api.get<{ data: ChapterApiRow[] }>('/chapters'),
      'Loading chapter applications',
      { data: [] }
    );

    setApplications(
      result.data
        .filter((c) => c.status === 'pending')
        .map((c) => ({ id: c.id, name: c.name, createdAt: c.created_at, meta: c.meta ?? {} }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(id: string) {
    const ok = await mutateOrToast(api.patch(`/chapters/${id}`, { status: 'active' }), 'Approving chapter');
    if (ok) { await load(); }
  }

  async function reject(id: string) {
    const ok = await mutateOrToast(api.patch(`/chapters/${id}`, { status: 'rejected' }), 'Rejecting chapter');
    if (ok) { await load(); }
  }

  return { applications, loading, reload: load, approve, reject };
}
