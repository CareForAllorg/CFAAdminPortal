import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';

export interface MappingProject {
  id: string;
  region: string;
  country: string;
  types: string[];
  url: string | null;
  color: string;
  description: string;
  mapping_level: string | null;
  featured: boolean;
  sort_order: number;
  created_at: string;
}

export type MappingProjectPayload = Partial<Omit<MappingProject, 'id' | 'created_at'>>;

// This table also backs the member-facing app's Mapping page (see
// VolunteerPortalCFA's GET /api/mapping/projects, which only returns
// featured = true rows) -- edits here take effect there immediately, no
// deploy needed on either side.
export function useMappingProjects() {
  const [projects, setProjects] = useState<MappingProject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiOrToast(api.get<{ data: MappingProject[] }>('/mapping-projects'), 'Loading mapping projects', { data: [] });
    setProjects(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createProject(payload: MappingProjectPayload) {
    const ok = await mutateOrToast(api.post('/mapping-projects', payload), 'Creating mapping task');
    if (ok) { await load(); }
    return ok;
  }

  async function updateProject(id: string, payload: MappingProjectPayload) {
    const ok = await mutateOrToast(api.patch(`/mapping-projects/${id}`, payload), 'Updating mapping task');
    if (ok) { await load(); }
    return ok;
  }

  return { projects, loading, createProject, updateProject, reload: load };
}
