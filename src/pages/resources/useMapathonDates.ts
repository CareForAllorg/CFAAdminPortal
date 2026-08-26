import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';

export interface MapathonDate {
  id: string;
  event_date: string;
  hours: number;
  label: string | null;
  created_at: string;
  total_buildings_mapped: number;
  total_km_roads_mapped: number;
  bonus_service_hours: number;
  attendance_list_path: string | null;
}

export type MapathonDatePayload = Partial<Omit<MapathonDate, 'id' | 'created_at'>>;

export const MAX_ATTENDANCE_BYTES = 5 * 1024 * 1024;

// readAsDataURL gives `data:<file.type>;base64,...` -- some browsers leave
// file.type empty for .csv, which would make the upload endpoint's
// text/csv|application/csv dataUrl regex reject the file. Normalize the
// prefix so the backend always sees a valid CSV dataUrl regardless of what
// the browser reported.
async function readCsvAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).replace(/^data:[^;]+;base64,/, 'data:text/csv;base64,'));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Backs the member-facing app's Mapathon Time Log "when was the mapathon"
// dropdown (VolunteerPortalCFA's GET /api/mapping/mapathon-dates) -- adding
// a date here makes it immediately selectable there, no deploy needed.
export function useMapathonDates() {
  const [dates, setDates] = useState<MapathonDate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiOrToast(api.get<{ data: MapathonDate[] }>('/mapathon-dates'), 'Loading mapathon dates', { data: [] });
    setDates(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Returns the created/updated row (not just a boolean) so the edit modal
  // can grab the new row's id -- needed to upload an attendance file picked
  // before a brand-new date had an id yet.
  async function createDate(payload: MapathonDatePayload): Promise<MapathonDate | null> {
    const result = await apiOrToast<{ data: MapathonDate } | null>(api.post('/mapathon-dates', payload), 'Adding mapathon date', null);
    if (result) { await load(); }
    return result?.data ?? null;
  }

  async function updateDate(id: string, payload: MapathonDatePayload): Promise<MapathonDate | null> {
    const result = await apiOrToast<{ data: MapathonDate } | null>(api.patch(`/mapathon-dates/${id}`, payload), 'Updating mapathon date', null);
    if (result) { await load(); }
    return result?.data ?? null;
  }

  async function deleteDate(id: string) {
    const ok = await mutateOrToast(api.delete(`/mapathon-dates/${id}`), 'Deleting mapathon date');
    if (ok) { await load(); }
    return ok;
  }

  // Uploads the attendance CSV to the private mapathon-attendance bucket
  // and returns the { path, attendeeCount, matchedCount, unmatchedCount }
  // the publish form then PATCHes the path onto the date (see
  // api/_handlers/uploads.ts). Re-uploading the same date replaces both
  // the stored file and the hours it already credited.
  async function uploadAttendance(dateId: string, file: File): Promise<{ path: string; attendeeCount: number; matchedCount: number; unmatchedCount: number } | null> {
    const dataUrl = await readCsvAsDataUrl(file);
    return apiOrToast<{ path: string; attendeeCount: number; matchedCount: number; unmatchedCount: number } | null>(
      api.post('/uploads/mapathon-attendance', { dateId, dataUrl }),
      'Uploading attendance list',
      null
    );
  }

  return { dates, loading, createDate, updateDate, deleteDate, uploadAttendance, reload: load };
}
