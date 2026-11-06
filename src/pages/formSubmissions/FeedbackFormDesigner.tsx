import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { api, apiOrToast } from '../../lib/apiClient';

type QuestionType = 'short_text' | 'long_text' | 'single_choice' | 'multi_choice' | 'rating' | 'yes_no';

interface Question {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
}

interface FormRecord {
  title: string;
  description: string | null;
  questions: Question[];
  target_roles: string[];
  target_user_ids: string[];
}

interface PersonHit { id: string; first_name: string | null; last_name: string | null; role: string }

const TYPE_LABELS: Record<QuestionType, string> = {
  short_text: 'Short answer',
  long_text: 'Long answer',
  single_choice: 'Multiple choice (pick one)',
  multi_choice: 'Checkboxes (pick many)',
  rating: 'Rating (1-5)',
  yes_no: 'Yes / No',
};

const ROLE_OPTIONS = [
  { key: 'chapter_lead', label: 'Chapter Lead' },
  { key: 'chapter_member', label: 'Chapter Member' },
  { key: 'partner_lead', label: 'Program Partner Lead' },
  { key: 'partner_member', label: 'Program Partner Member' },
  { key: 'independent_member', label: 'Independent Member' },
  { key: 'mentor', label: 'Mentor' },
];

const inputClass = 'w-full px-3 py-[8px] bg-bg border border-border rounded-lg text-[13px] text-text outline-none font-sans';

function newQuestion(): Question {
  return { id: crypto.randomUUID(), label: '', type: 'short_text', required: false };
}

function personName(p: PersonHit): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unnamed';
}

export function FeedbackFormDesigner({ formId, onClose, onSaved }: { formId: string | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([newQuestion()]);
  const [roles, setRoles] = useState<string[]>([]);
  const [people, setPeople] = useState<PersonHit[]>([]);
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<PersonHit[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!formId);

  useEffect(() => {
    if (!formId) { return; }
    (async () => {
      const res = await apiOrToast(api.get<{ data: FormRecord }>(`/feedback-forms/${formId}`), 'Loading form', null);
      if (res) {
        setTitle(res.data.title);
        setDescription(res.data.description ?? '');
        setQuestions(res.data.questions);
        setRoles(res.data.target_roles);
        // Names for already-picked people aren't stored on the form -- look them up.
        const picked = await Promise.all(
          res.data.target_user_ids.map((id) => api.get<{ data: PersonHit }>(`/profiles/${id}`).then((r) => r.data).catch(() => null)),
        );
        setPeople(picked.filter((p): p is PersonHit => !!p));
      }
      setLoading(false);
    })();
  }, [formId]);

  useEffect(() => {
    if (search.trim().length < 2) { setHits([]); return; }
    const handle = setTimeout(async () => {
      const res = await api.get<{ data: PersonHit[] }>(`/feedback-forms/recipient-search?q=${encodeURIComponent(search.trim())}`).catch(() => null);
      setHits((res?.data ?? []).filter((h) => !people.some((p) => p.id === h.id)));
    }, 250);
    return () => clearTimeout(handle);
  }, [search, people]);

  function updateQuestion(id: string, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function move(index: number, dir: -1 | 1) {
    setQuestions((qs) => {
      const next = [...qs];
      const target = index + dir;
      if (target < 0 || target >= next.length) { return qs; }
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const body = {
      title,
      description,
      questions: questions.map((q) => ({
        ...q,
        options: q.type === 'single_choice' || q.type === 'multi_choice' ? q.options ?? [] : undefined,
      })),
      target_roles: roles,
      target_user_ids: people.map((p) => p.id),
    };
    const res = await apiOrToast(
      formId ? api.patch(`/feedback-forms/${formId}`, body) : api.post('/feedback-forms', body),
      'Saving form',
      null,
    );
    setSaving(false);
    if (res) { onSaved(); }
  }

  const hasRecipients = roles.length > 0 || people.length > 0;

  return (
    <Modal open onClose={onClose} wide title={formId ? 'Edit Feedback Form' : 'New Feedback Form'} subtitle="Saved as a draft -- release it from the list when it's ready.">
      {loading ? (
        <div className="p-6 text-muted text-[13px]">Loading…</div>
      ) : (
        <div className="p-6 flex flex-col gap-5">
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.05em]">Title</label>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fall Chapter Check-In Survey" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.05em]">Description (optional)</label>
            <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div>
            <div className="text-[11px] font-bold text-muted uppercase tracking-[0.05em] mb-2">Questions</div>
            <div className="flex flex-col gap-3">
              {questions.map((q, i) => (
                <div key={q.id} className="border border-border rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input className={inputClass} value={q.label} placeholder={`Question ${i + 1}`} onChange={(e) => updateQuestion(q.id, { label: e.target.value })} />
                    <select
                      className={`${inputClass} !w-[230px]`}
                      value={q.type}
                      onChange={(e) => updateQuestion(q.id, { type: e.target.value as QuestionType, options: ['single_choice', 'multi_choice'].includes(e.target.value) ? q.options ?? ['', ''] : undefined })}
                    >
                      {Object.entries(TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                  </div>
                  {q.type === 'single_choice' || q.type === 'multi_choice' ? (
                    <textarea
                      className={inputClass}
                      rows={3}
                      placeholder="One option per line"
                      value={(q.options ?? []).join('\n')}
                      onChange={(e) => updateQuestion(q.id, { options: e.target.value.split('\n') })}
                    />
                  ) : null}
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] text-text flex items-center gap-2">
                      <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(q.id, { required: e.target.checked })} /> Required
                    </label>
                    <div className="flex gap-2 text-[12px]">
                      <button type="button" className="text-brand font-bold disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                      <button type="button" className="text-brand font-bold disabled:opacity-30" disabled={i === questions.length - 1} onClick={() => move(i, 1)}>↓</button>
                      <button type="button" className="text-accent font-bold disabled:opacity-30" disabled={questions.length === 1} onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="!text-[12px] !px-3 !py-[7px] mt-3" onClick={() => setQuestions((qs) => [...qs, newQuestion()])}>
              <i className="ti ti-plus text-[13px] mr-1" />Add Question
            </Button>
          </div>

          <div>
            <div className="text-[11px] font-bold text-muted uppercase tracking-[0.05em] mb-2">Send To</div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mb-3">
              {ROLE_OPTIONS.map((r) => (
                <label key={r.key} className="text-[12.5px] text-text flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roles.includes(r.key)}
                    onChange={(e) => setRoles((cur) => (e.target.checked ? [...cur, r.key] : cur.filter((k) => k !== r.key)))}
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <input className={inputClass} placeholder="Search members by name to add individuals…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {hits.length > 0 ? (
              <div className="border border-border rounded-lg mt-1 max-h-[160px] overflow-y-auto">
                {hits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-bg flex justify-between"
                    onClick={() => { setPeople((p) => [...p, h]); setSearch(''); setHits([]); }}
                  >
                    <span>{personName(h)}</span><span className="text-muted">{h.role}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {people.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-3">
                {people.map((p) => (
                  <span key={p.id} className="text-[12px] bg-bg border border-border rounded-full px-3 py-1 flex items-center gap-2">
                    {personName(p)}
                    <button type="button" className="text-muted hover:text-accent" onClick={() => setPeople((cur) => cur.filter((x) => x.id !== p.id))}>×</button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={saving || !title.trim() || !hasRecipients} onClick={handleSave}>{saving ? 'Saving…' : 'Save Draft'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
