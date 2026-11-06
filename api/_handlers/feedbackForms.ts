import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestContext } from '../_lib/auth.js';
import { badRequest, methodNotAllowed, sendJson } from '../_lib/http.js';
import { firstQueryValue } from '../_lib/pagination.js';

const VOLUNTEER_PORTAL_URL = process.env.VOLUNTEER_PORTAL_URL ?? 'https://volunteer.careforall.org';

export const QUESTION_TYPES = ['short_text', 'long_text', 'single_choice', 'multi_choice', 'rating', 'yes_no'] as const;
export const TARGET_ROLES = ['chapter_lead', 'chapter_member', 'partner_lead', 'partner_member', 'independent_member', 'mentor'] as const;

interface Question {
  id: string;
  label: string;
  type: (typeof QUESTION_TYPES)[number];
  required: boolean;
  options?: string[];
}

// The three feedback_* tables aren't in database.generated.ts yet, so this
// uses an untyped view of the caller's own (admin) client.
function db(ctx: RequestContext): SupabaseClient {
  return ctx.supabase as unknown as SupabaseClient;
}

function validateQuestions(raw: unknown): Question[] | string {
  if (!Array.isArray(raw) || raw.length === 0) { return 'Add at least one question'; }
  const out: Question[] = [];
  for (const q of raw) {
    const label = typeof q?.label === 'string' ? q.label.trim() : '';
    if (!label) { return 'Every question needs text'; }
    if (!QUESTION_TYPES.includes(q?.type)) { return `Unknown question type: ${String(q?.type)}`; }
    const question: Question = {
      id: typeof q.id === 'string' && q.id ? q.id : crypto.randomUUID(),
      label,
      type: q.type,
      required: q.required === true,
    };
    if (q.type === 'single_choice' || q.type === 'multi_choice') {
      const options = (Array.isArray(q.options) ? q.options : [])
        .map((o: unknown) => (typeof o === 'string' ? o.trim() : ''))
        .filter(Boolean);
      if (options.length < 2) { return `"${label}" needs at least two options`; }
      question.options = options;
    }
    out.push(question);
  }
  return out;
}

function pathSegments(req: VercelRequest): string[] {
  const raw = req.query.path;
  return (Array.isArray(raw) ? raw.join('/') : raw ?? '').split('/').filter(Boolean);
}

// Supabase caps a plain select at 1000 rows -- page through everything.
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) { throw error; }
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) { break; }
  }
  return rows;
}

interface Recipient { id: string; email: string | null; firstName: string }

// Union of everyone matching a selected role plus anyone picked by name.
// Partner lead/member are the chapter_lead/chapter_member roles whose
// chapter has meta.is_partner (a partner is a chapters row under the hood).
async function resolveRecipients(ctx: RequestContext, roles: string[], userIds: string[]): Promise<Recipient[]> {
  const supabase = db(ctx);
  const [profiles, chapters, users] = await Promise.all([
    fetchAll<{ id: string; first_name: string | null; role: string; chapter_id: string | null }>(
      (a, b) => supabase.from('profiles').select('id, first_name, role, chapter_id').range(a, b),
    ),
    fetchAll<{ id: string; meta: { is_partner?: boolean } | null }>(
      (a, b) => supabase.from('chapters').select('id, meta').range(a, b),
    ),
    fetchAll<{ id: string; email: string | null }>(
      (a, b) => supabase.from('users').select('id, email').range(a, b),
    ),
  ]);

  const partnerChapters = new Set(chapters.filter((c) => c.meta?.is_partner).map((c) => c.id));
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  const picked = new Set(userIds);

  const matches = (p: (typeof profiles)[number]): boolean => {
    if (picked.has(p.id)) { return true; }
    const inPartner = !!p.chapter_id && partnerChapters.has(p.chapter_id);
    for (const role of roles) {
      if (role === 'chapter_lead' && p.role === 'chapter_lead' && !inPartner) { return true; }
      if (role === 'partner_lead' && p.role === 'chapter_lead' && inPartner) { return true; }
      if (role === 'chapter_member' && p.role === 'chapter_member' && !inPartner) { return true; }
      if (role === 'partner_member' && p.role === 'chapter_member' && inPartner) { return true; }
      if (role === 'independent_member' && p.role === 'independent_member') { return true; }
      if (role === 'mentor' && p.role === 'mentor') { return true; }
    }
    return false;
  };

  return profiles
    .filter(matches)
    .map((p) => ({ id: p.id, email: emailById.get(p.id) ?? null, firstName: p.first_name?.trim() || 'there' }));
}

export async function feedbackForms(req: VercelRequest, res: VercelResponse, ctx: RequestContext, sub?: string) {
  const [, , action] = pathSegments(req);

  if (sub === 'recipient-search') { return recipientSearch(req, res, ctx); }
  if (sub && action === 'release') { return release(req, res, ctx, sub); }
  if (sub && action === 'resend') { return resend(req, res, ctx, sub); }
  if (sub && action === 'responses') { return responses(req, res, ctx, sub); }
  if (sub) { return byId(req, res, ctx, sub); }

  const supabase = db(ctx);

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('feedback_forms')
      .select('id, title, description, status, target_roles, target_user_ids, created_at, released_at')
      .order('created_at', { ascending: false });
    if (error) { throw error; }

    const [recipients, resp] = await Promise.all([
      fetchAll<{ form_id: string }>((a, b) => supabase.from('feedback_form_recipients').select('form_id').range(a, b)),
      fetchAll<{ form_id: string }>((a, b) => supabase.from('feedback_form_responses').select('form_id').range(a, b)),
    ]);
    const count = (rows: { form_id: string }[], id: string) => rows.filter((r) => r.form_id === id).length;

    sendJson(res, 200, {
      data: (data ?? []).map((f) => ({ ...f, recipient_count: count(recipients, f.id), response_count: count(resp, f.id) })),
    });
    return;
  }

  if (req.method === 'POST') {
    const parsed = parseFormBody(req, res);
    if (!parsed) { return; }
    const { data, error } = await supabase
      .from('feedback_forms')
      .insert({ ...parsed, created_by: ctx.user.id })
      .select('*')
      .single();
    if (error) { throw error; }
    sendJson(res, 201, { data });
    return;
  }

  methodNotAllowed(res, ['GET', 'POST']);
}

function parseFormBody(req: VercelRequest, res: VercelResponse) {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) { badRequest(res, 'title is required'); return null; }

  const questions = validateQuestions(req.body?.questions);
  if (typeof questions === 'string') { badRequest(res, questions); return null; }

  const targetRoles = (Array.isArray(req.body?.target_roles) ? req.body.target_roles : [])
    .filter((r: unknown) => (TARGET_ROLES as readonly string[]).includes(r as string));
  const targetUserIds = (Array.isArray(req.body?.target_user_ids) ? req.body.target_user_ids : [])
    .filter((u: unknown) => typeof u === 'string');

  return {
    title,
    description: typeof req.body?.description === 'string' && req.body.description.trim() ? req.body.description.trim() : null,
    questions,
    target_roles: targetRoles,
    target_user_ids: targetUserIds,
  };
}

async function byId(req: VercelRequest, res: VercelResponse, ctx: RequestContext, id: string) {
  const supabase = db(ctx);

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('feedback_forms').select('*').eq('id', id).single();
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'PATCH') {
    const { data: existing, error: existingError } = await supabase.from('feedback_forms').select('status').eq('id', id).single();
    if (existingError) { throw existingError; }
    if (existing.status === 'released') { badRequest(res, 'A released form can no longer be edited'); return; }

    const parsed = parseFormBody(req, res);
    if (!parsed) { return; }
    const { data, error } = await supabase.from('feedback_forms').update(parsed).eq('id', id).select('*').single();
    if (error) { throw error; }
    sendJson(res, 200, { data });
    return;
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('feedback_forms').delete().eq('id', id);
    if (error) { throw error; }
    sendJson(res, 204, null);
    return;
  }

  methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
}

// Searchable picker for "send to specific people".
async function recipientSearch(req: VercelRequest, res: VercelResponse, ctx: RequestContext) {
  if (req.method !== 'GET') { methodNotAllowed(res, ['GET']); return; }
  const q = (firstQueryValue(req, 'q') ?? '').trim();
  if (q.length < 2) { sendJson(res, 200, { data: [] }); return; }

  const supabase = db(ctx);
  // Match by email (lives on public.users) or by name (every word must match
  // the first or last name, so "Jane Smith" works).
  const emailSafe = q.replace(/[%,()*]/g, '');
  const { data: emailRows, error: emailError } = await supabase
    .from('users')
    .select('id')
    .ilike('email', `%${emailSafe}%`)
    .limit(15);
  if (emailError) { throw emailError; }
  const emailIds = (emailRows ?? []).map((u) => u.id as string);

  let nameQuery = supabase.from('profiles').select('id, first_name, last_name, role');
  for (const token of q.split(/\s+/)) {
    const safe = token.replace(/[%,()*]/g, '');
    if (safe) { nameQuery = nameQuery.or(`first_name.ilike.*${safe}*,last_name.ilike.*${safe}*`); }
  }
  const [{ data: byName, error }, { data: byEmail, error: byEmailError }] = await Promise.all([
    nameQuery.limit(15),
    emailIds.length
      ? supabase.from('profiles').select('id, first_name, last_name, role').in('id', emailIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (error) { throw error; }
  if (byEmailError) { throw byEmailError; }

  const merged = new Map<string, { id: string; first_name: string | null; last_name: string | null; role: string }>();
  for (const row of [...(byEmail ?? []), ...(byName ?? [])]) { merged.set(row.id, row); }
  const rows = [...merged.values()].slice(0, 15);

  const { data: emails } = rows.length
    ? await supabase.from('users').select('id, email').in('id', rows.map((r) => r.id))
    : { data: [] };
  const emailById = new Map((emails ?? []).map((u) => [u.id as string, u.email as string | null]));
  const data = rows.map((r) => ({ ...r, email: emailById.get(r.id) ?? null }));
  sendJson(res, 200, { data });
}

// One-shot release: resolves the recipient list, stores it, flips the form
// to 'released', then asks the volunteer portal (which owns Resend) to send
// the "CareForAll Needs You to Fill Out a Form!" email.
async function release(req: VercelRequest, res: VercelResponse, ctx: RequestContext, id: string) {
  if (req.method !== 'POST') { methodNotAllowed(res, ['POST']); return; }
  const supabase = db(ctx);

  const { data: form, error } = await supabase.from('feedback_forms').select('*').eq('id', id).single();
  if (error) { throw error; }
  if (form.status === 'released') { badRequest(res, 'This form has already been released'); return; }

  const recipients = await resolveRecipients(ctx, form.target_roles ?? [], form.target_user_ids ?? []);
  if (recipients.length === 0) { badRequest(res, 'No members match the selected roles or names'); return; }

  const { error: recipientError } = await supabase
    .from('feedback_form_recipients')
    .upsert(recipients.map((r) => ({ form_id: id, user_id: r.id })), { onConflict: 'form_id,user_id' });
  if (recipientError) { throw recipientError; }

  const { error: releaseError } = await supabase
    .from('feedback_forms')
    .update({ status: 'released', released_at: new Date().toISOString() })
    .eq('id', id);
  if (releaseError) { throw releaseError; }

  const { emailed, emailError } = await sendNotifications(supabase, id, form.title, recipients);

  sendJson(res, 200, { recipientCount: recipients.length, emailed, emailError });
}

// Asks the volunteer portal to email the given recipients and stamps notified_at.
async function sendNotifications(supabase: ReturnType<typeof db>, id: string, title: string, recipients: Recipient[]) {
  let emailed = 0;
  let emailError: string | null = null;
  const withEmail = recipients.filter((r) => r.email);
  try {
    const secret = process.env.PARTNER_INVITE_SECRET;
    if (!secret) { throw new Error('PARTNER_INVITE_SECRET is not set'); }
    const notifyRes = await fetch(`${VOLUNTEER_PORTAL_URL}/api/feedback-forms/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-partner-invite-secret': secret,
        // Lets server-to-server calls through Vercel Authentication on preview deployments.
        ...(process.env.VOLUNTEER_PORTAL_BYPASS ? { 'x-vercel-protection-bypass': process.env.VOLUNTEER_PORTAL_BYPASS } : {}),
      },
      body: JSON.stringify({
        formId: id,
        title,
        recipients: withEmail.map((r) => ({ email: r.email, firstName: r.firstName })),
      }),
    });
    if (!notifyRes.ok) { throw new Error(`Volunteer portal at ${VOLUNTEER_PORTAL_URL} responded ${notifyRes.status}`); }
    emailed = withEmail.length;
    await supabase
      .from('feedback_form_recipients')
      .update({ notified_at: new Date().toISOString() })
      .eq('form_id', id)
      .in('user_id', withEmail.map((r) => r.id));
  } catch (err) {
    emailError = err instanceof Error ? err.message : 'Failed to send notification emails';
    console.error('[feedback-forms] notify failed:', err);
  }
  return { emailed, emailError };
}

// Re-sends the email to released-form recipients who haven't responded yet.
async function resend(req: VercelRequest, res: VercelResponse, ctx: RequestContext, id: string) {
  if (req.method !== 'POST') { methodNotAllowed(res, ['POST']); return; }
  const supabase = db(ctx);

  const { data: form, error } = await supabase.from('feedback_forms').select('*').eq('id', id).single();
  if (error) { throw error; }
  if (form.status !== 'released') { badRequest(res, 'Release the form before resending'); return; }

  const [stored, answered, resolved] = await Promise.all([
    fetchAll<{ user_id: string }>((a, b) => supabase.from('feedback_form_recipients').select('user_id').eq('form_id', id).range(a, b)),
    fetchAll<{ user_id: string }>((a, b) => supabase.from('feedback_form_responses').select('user_id').eq('form_id', id).range(a, b)),
    resolveRecipients(ctx, form.target_roles ?? [], form.target_user_ids ?? []),
  ]);
  const storedIds = new Set(stored.map((r) => r.user_id));
  const answeredIds = new Set(answered.map((r) => r.user_id));
  const pending = resolved.filter((r) => storedIds.has(r.id) && !answeredIds.has(r.id));
  if (pending.length === 0) { badRequest(res, 'Everyone has already responded'); return; }

  const { emailed, emailError } = await sendNotifications(supabase, id, form.title, pending);
  sendJson(res, 200, { recipientCount: pending.length, emailed, emailError });
}

async function responses(req: VercelRequest, res: VercelResponse, ctx: RequestContext, id: string) {
  if (req.method !== 'GET') { methodNotAllowed(res, ['GET']); return; }
  const supabase = db(ctx);

  const { data: form, error } = await supabase.from('feedback_forms').select('title, questions').eq('id', id).single();
  if (error) { throw error; }

  const rows = await fetchAll<{ user_id: string; answers: Record<string, unknown>; submitted_at: string }>(
    (a, b) => supabase.from('feedback_form_responses').select('user_id, answers, submitted_at').eq('form_id', id).order('submitted_at').range(a, b),
  );
  const ids = rows.map((r) => r.user_id);
  const [profiles, users] = ids.length
    ? await Promise.all([
        supabase.from('profiles').select('id, first_name, last_name, role').in('id', ids.slice(0, 500)),
        supabase.from('users').select('id, email').in('id', ids.slice(0, 500)),
      ])
    : [{ data: [] }, { data: [] }];
  const profileById = new Map((profiles.data ?? []).map((p: { id: string }) => [p.id, p]));
  const emailById = new Map((users.data ?? []).map((u: { id: string; email: string | null }) => [u.id, u.email]));

  const questions = form.questions as Question[];
  const data = rows.map((r) => {
    const p = profileById.get(r.user_id) as { first_name: string | null; last_name: string | null; role: string } | undefined;
    const row: Record<string, unknown> = {
      name: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || '—',
      email: emailById.get(r.user_id) ?? '',
      role: p?.role ?? '',
      submitted_at: r.submitted_at,
    };
    for (const q of questions) { row[q.id] = r.answers?.[q.id] ?? ''; }
    return row;
  });

  const columns = [
    { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' },
    ...questions.map((q) => ({ key: q.id, label: q.label })),
    { key: 'submitted_at', label: 'Submitted' },
  ];

  sendJson(res, 200, { data, columns, total: data.length });
}
