import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { api, apiOrToast } from '../../lib/apiClient';
import { downloadCsv, type CsvColumn } from '../../utils/csv';

interface FormResponseData {
  data: Record<string, unknown>[];
  columns: CsvColumn[];
  total: number;
}

interface FormResponseModalProps {
  formType: string | null;
  title: string;
  onClose: () => void;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined || value === '') { return '—'; }
  if (Array.isArray(value)) { return value.length ? value.join(', ') : '—'; }
  if (typeof value === 'boolean') { return value ? 'Yes' : 'No'; }
  return String(value);
}

// Generic viewer for every "Total Portal Forms List" entry -- one table
// renderer covers all of them since each backend branch in
// api/_handlers/formSubmissions.ts already normalizes its rows down to
// the same { data, columns } shape.
export function FormResponseModal({ formType, title, onClose }: FormResponseModalProps) {
  const [result, setResult] = useState<FormResponseData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!formType) { setResult(null); return; }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const res = await apiOrToast(api.get<FormResponseData>(`/form-submissions/${formType}`), 'Loading responses', null);
      if (!cancelled) {
        setResult(res);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [formType]);

  if (!formType) { return null; }

  return (
    <div
      className="fixed inset-0 bg-sidebar/55 z-[200] flex items-center justify-center p-5"
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
    >
      <div className="bg-white rounded-2xl w-[1040px] max-w-full max-h-[85vh] flex flex-col shadow-[0_24px_60px_rgba(20,34,74,0.3)]">
        <div className="px-6 pt-[22px] pb-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="font-heading text-[19px] text-brand tracking-[0.01em]">{title}</div>
            <div className="text-[12px] text-muted mt-[3px]">{result ? `${result.total} response${result.total === 1 ? '' : 's'}` : 'Loading…'}</div>
          </div>
          <div className="flex items-center gap-[10px] shrink-0">
            {result && result.total > 0 ? (
              <Button
                variant="outline"
                className="!text-[12px] !px-3 !py-[7px]"
                onClick={() => downloadCsv(`${formType}.csv`, result.columns, result.data)}
              >
                <i className="ti ti-download text-[13px] mr-1" />Download CSV
              </Button>
            ) : null}
            <button
              onClick={onClose}
              className="w-[30px] h-[30px] rounded-full border-none bg-bg text-muted flex items-center justify-center cursor-pointer shrink-0 text-[15px] transition-colors duration-150 hover:bg-accent hover:text-white"
            >
              <i className="ti ti-x" />
            </button>
          </div>
        </div>

        <div className="overflow-auto px-6 py-4">
          {loading || !result ? (
            <div className="text-center py-10 text-muted text-[13px]">{loading ? 'Loading…' : 'Could not load responses.'}</div>
          ) : result.total === 0 ? (
            <div className="text-center py-10 text-muted text-[13px]">No submissions yet.</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {result.columns.map((c) => (
                    <th key={c.key} className="text-left text-[10.5px] font-bold text-muted uppercase tracking-[0.05em] px-3 py-2 border-b border-border whitespace-nowrap sticky top-0 bg-white">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-bg">
                    {result.columns.map((c) => (
                      <td key={c.key} className="text-[12.5px] text-text px-3 py-[9px] border-b border-border align-top max-w-[280px]">
                        {cellText(row[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
