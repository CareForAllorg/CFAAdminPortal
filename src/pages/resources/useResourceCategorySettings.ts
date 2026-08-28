import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';

interface CategorySettingRow {
  category: string;
  hidden: boolean;
}

// Whether an entire resource section is hidden from the member dashboard,
// independent of individual resources' own published/hidden status -- a
// category with no row here is visible by default.
export function useResourceCategorySettings() {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await apiOrToast(
      api.get<{ data: CategorySettingRow[] }>('/resource-category-settings'),
      'Loading section visibility',
      { data: [] }
    );
    setHiddenCategories(new Set(result.data.filter((r) => r.hidden).map((r) => r.category)));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setCategoryHidden(category: string, hidden: boolean) {
    const ok = await mutateOrToast(
      api.patch(`/resource-category-settings/${encodeURIComponent(category)}`, { hidden }),
      hidden ? 'Hiding section' : 'Showing section'
    );
    if (ok) { await load(); }
    return ok;
  }

  return { hiddenCategories, loading, setCategoryHidden };
}
