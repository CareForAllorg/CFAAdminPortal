import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { api, apiOrToast } from '../../lib/apiClient';
import { downloadCsv, type CsvColumn } from '../../utils/csv';
import { FormResponseModal } from './FormResponseModal';
import { FeedbackFormDesigner } from './FeedbackFormDesigner';

interface FeedbackFormRow {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'released';
  created_at: string;
  released_at: string | null;
  recipient_count: number;
  response_count: number;
}

// The dedicated "Feedback Forms" section of Form Submissions: forms an
// admin designs here and releases to chosen members/roles, with their
// responses (the volunteer portal writes them to feedback_form_responses).
export function FeedbackFormsSection() {
  const [forms, setForms] = useState<FeedbackFormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [designingId, setDesigningId] = useState<string | 'new' | null>(null);
  const [viewing, setViewing] = useState<FeedbackFormRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiOrToast(api.get<{ data: FeedbackFormRow[] }>('/feedback-forms'), 'Loading feedback forms', null);
    if (res) { setForms(res.data); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleDownload(form: FeedbackFormRow) {
    setBusyId(form.id);
    const res = await apiOrToast(
      api.get<{ data: Record<string, unknown>[]; columns: CsvColumn[] }>(`/feedback-forms/${form.id}/responses`),
      'Loading responses',
      null,
    );
    if (res) { downloadCsv(`feedback-${form.title.replace(/\W+/g, '-').toLowerCase()}.csv`, res.columns, res.data); }
    setBusyId(null);
  }

  async function handleDelete(form: FeedbackFormRow) {
    if (!window.confirm(`Delete "${form.title}"${form.response_count ? ` and its ${form.response_count} responses` : ''}? This cannot be undone.`)) { return; }
    setBusyId(form.id);
    await apiOrToast(api.delete(`/feedback-forms/${form.id}`), 'Deleting form', null);
    setBusyId(null);
    void load();
  }

  async function handleRelease(form: FeedbackFormRow) {
    if (!window.confirm(`Release "${form.title}"? Every recipient will be emailed and the form can no longer be edited.`)) { return; }
    setBusyId(form.id);
    const res = await apiOrToast(
      api.post<{ recipientCount: number; emailed: number; emailError: string | null }>(`/feedback-forms/${form.id}/release`),
      'Releasing form',
      null,
    );
    setBusyId(null);
    if (res) {
      if (res.emailError) { toast.error(`Released to ${res.recipientCount} people, but emails failed: ${res.emailError}`); }
      else { toast.success(`Released to ${res.recipientCount} people (${res.emailed} emailed)`); }
    }
    void load();
  }

  async function handleResend(form: FeedbackFormRow) {
    if (!window.confirm(`Re-send the email for "${form.title}" to everyone who hasn't responded yet?`)) { return; }
    setBusyId(form.id);
    const res = await apiOrToast(
      api.post<{ recipientCount: number; emailed: number; emailError: string | null }>(`/feedback-forms/${form.id}/resend`),
      'Resending emails',
      null,
    );
    setBusyId(null);
    if (res) {
      if (res.emailError) { toast.error(`Emails failed: ${res.emailError}`); }
      else { toast.success(`Re-sent to ${res.emailed} people who haven't responded`); }
    }
    void load();
  }

  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-[14px] font-bold text-text flex items-center gap-2">
            <i className="ti ti-message-2-question text-muted text-[17px]" /> Feedback Forms
          </div>
          <Button className="!text-[12px] !px-3 !py-[7px]" onClick={() => setDesigningId('new')}>
            <i className="ti ti-plus text-[13px] mr-1" />New Feedback Form
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted text-[13px]">Loading…</div>
        ) : forms.length === 0 ? (
          <div className="text-center py-8 text-muted text-[13px]">No feedback forms yet. Design one and release it to members or roles.</div>
        ) : (
          forms.map((form) => (
            <div key={form.id} className="flex items-center justify-between gap-4 py-[16px] border-b border-border last:border-b-0">
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-text">
                  {form.title}{' '}
                  <span className={`ml-1 text-[10.5px] font-bold uppercase tracking-[0.05em] ${form.status === 'released' ? 'text-brand' : 'text-muted'}`}>
                    {form.status}
                  </span>
                </div>
                <div className="text-[12px] text-muted mt-[3px]">
                  {form.status === 'released'
                    ? `${form.response_count} of ${form.recipient_count} responded`
                    : 'Draft -- not sent to anyone yet'}
                </div>
              </div>
              <div className="flex items-center gap-[10px] shrink-0">
                {form.status === 'draft' ? (
                  <>
                    <Button variant="outline" className="!text-[12px] !px-3 !py-[7px]" onClick={() => setDesigningId(form.id)}>Edit</Button>
                    <Button className="!text-[12px] !px-3 !py-[7px]" disabled={busyId === form.id} onClick={() => handleRelease(form)}>Release</Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" className="!text-[12px] !px-3 !py-[7px]" disabled={busyId === form.id} onClick={() => handleResend(form)}>Resend Email</Button>
                    <Button variant="outline" className="!text-[12px] !px-3 !py-[7px]" onClick={() => setViewing(form)}>View Responses</Button>
                    <Button variant="outline" className="!text-[12px] !px-3 !py-[7px]" disabled={busyId === form.id} onClick={() => handleDownload(form)}>
                      <i className="ti ti-download text-[13px] mr-1" />Download CSV
                    </Button>
                  </>
                )}
                <Button variant="danger" className="!text-[12px] !px-3 !py-[7px]" disabled={busyId === form.id} onClick={() => handleDelete(form)}>Delete</Button>
              </div>
            </div>
          ))
        )}
      </Card>

      {designingId ? (
        <FeedbackFormDesigner
          formId={designingId === 'new' ? null : designingId}
          onClose={() => setDesigningId(null)}
          onSaved={() => { setDesigningId(null); void load(); }}
        />
      ) : null}

      <FormResponseModal
        formType={viewing ? `feedback-${viewing.id}` : null}
        path={viewing ? `/feedback-forms/${viewing.id}/responses` : undefined}
        title={viewing?.title ?? ''}
        onClose={() => setViewing(null)}
      />
    </>
  );
}
