import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';
import type { Resource } from '../../types/database';

export interface ResourceGroups {
  Handbooks: Resource[];
  Toolkits: Resource[];
  Videos: Resource[];
  Other: Resource[];
  'Chapter Lead': Resource[];
}

function groupByCategory(list: Resource[]): ResourceGroups {
  const groups: ResourceGroups = { Handbooks: [], Toolkits: [], Videos: [], Other: [], 'Chapter Lead': [] };
  list.forEach((r) => {
    (groups[r.category] ?? groups.Other).push(r);
  });
  return groups;
}

export function useResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await apiOrToast(api.get<{ data: Resource[] }>('/resources'), 'Loading resources', { data: [] });
    setResources(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createResource(payload: Partial<Resource>) {
    const ok = await mutateOrToast(api.post('/resources', payload), 'Creating resource');
    if (ok) { await load(); }
    return ok;
  }

  async function updateResource(id: string, payload: Partial<Resource>) {
    const ok = await mutateOrToast(api.patch(`/resources/${id}`, payload), 'Updating resource');
    if (ok) { await load(); }
    return ok;
  }

  async function deleteResource(id: string) {
    const ok = await mutateOrToast(api.delete(`/resources/${id}`), 'Deleting resource');
    if (ok) { await load(); }
    return ok;
  }

  // orderedIds is the full new order for one category (drag-and-drop drops
  // the whole reordered list, not just the one moved row) -- reassigns
  // sort_order 0..n-1 across it in a single request.
  async function reorderResources(orderedIds: string[]) {
    const ok = await mutateOrToast(api.patch('/resources/reorder', { orderedIds }), 'Reordering resources');
    if (ok) { await load(); }
    return ok;
  }

  return { groups: groupByCategory(resources), loading, createResource, updateResource, deleteResource, reorderResources, reload: load };
}
