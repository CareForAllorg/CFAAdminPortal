import { useState } from 'react';
import { Topbar } from '../../components/Topbar';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { api, apiOrToast } from '../../lib/apiClient';
import { downloadCsv, type CsvColumn } from '../../utils/csv';
import { FormResponseModal } from './FormResponseModal';

const VOLUNTEER_PORTAL_BASE = 'https://volunteer.careforall.org';

interface FormDef {
  formType: string;
  title: string;
  description: string;
  openPath?: string;
  external?: { label: string; url: string };
}

// The full "Total Portal Forms List" -- every member-facing form on
// VolunteerPortalCFA that produces reportable submissions, each backed
// by a branch in api/_handlers/formSubmissions.ts. "Become a Mentor"
// isn't wired to any table here (it's an external Google Form), so it's
// shown as an informational row only, not a fabricated data source.
const FORMS: FormDef[] = [
  {
    formType: 'members',
    title: 'Become a Member',
    description: 'Member Registration Sign Up -- the onboarding personal-info step every new member and chapter lead completes.',
    openPath: '/onboarding',
  },
  {
    formType: 'chapter-lead-signups',
    title: 'Start a Chapter (at Sign Up)',
    description: 'Chapter Registration Sign Up -- the onboarding path for members who apply to lead a chapter at registration time.',
    openPath: '/onboarding',
  },
  {
    formType: 'chapter-applications',
    title: 'Chapter Application Form',
    description: 'Chapter applications filed later from Chapter Hub by already-onboarded independent members.',
    openPath: '/portal/chapter-hub',
  },
  {
    formType: 'project-submissions',
    title: 'Project Time Log',
    description: 'Project Hub submissions -- start-a-project wizard entries and wrap-up activity summaries.',
    openPath: '/portal/projects',
  },
  {
    formType: 'mapping-mapathon-logs',
    title: 'Mapping & Mapathon Time Log',
    description: 'Service hour submissions for mapping tasks and mapathon events, any approval status.',
    openPath: '/portal/mapping',
  },
  {
    formType: 'service-hour-verifications',
    title: 'Service Hour Verification Form',
    description: 'General service hour submissions -- mentorship, impact hours, and other org-verified activity.',
    openPath: '/portal/service-hours',
  },
];

const MENTOR_FORM = {
  title: 'Become a Mentor',
  description: 'Collected via an external Google Form, not this portal -- there\'s no live response data to show here.',
};

export function FormSubmissionsPage() {
  const [viewing, setViewing] = useState<FormDef | null>(null);
  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  async function handleDownload(form: FormDef) {
    setDownloadingType(form.formType);
    const res = await apiOrToast(
      api.get<{ data: Record<string, unknown>[]; columns: CsvColumn[] }>(`/form-submissions/${form.formType}`),
      'Loading responses',
      null,
    );
    if (res) { downloadCsv(`${form.formType}.csv`, res.columns, res.data); }
    setDownloadingType(null);
  }

  return (
    <>
      <Topbar title="Form Submissions" />
      <div className="text-[12.5px] text-muted -mt-[10px]">
        Every form on the volunteer portal, with real submission data pulled from the same tables the rest of this admin portal uses.
      </div>

      <Card>
        <div className="text-[14px] font-bold text-text flex items-center gap-2 mb-4">
          <i className="ti ti-forms text-muted text-[17px]" /> Total Portal Forms List
        </div>

        <div>
          {FORMS.map((form) => (
            <div key={form.formType} className="flex items-center justify-between gap-4 py-[16px] border-b border-border last:border-b-0">
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-text">{form.title}</div>
                <div className="text-[12px] text-muted mt-[3px]">{form.description}</div>
              </div>
              <div className="flex items-center gap-[10px] shrink-0">
                <Button variant="outline" className="!text-[12px] !px-3 !py-[7px]" onClick={() => setViewing(form)}>
                  View Responses
                </Button>
                <Button
                  variant="outline"
                  className="!text-[12px] !px-3 !py-[7px]"
                  disabled={downloadingType === form.formType}
                  onClick={() => handleDownload(form)}
                >
                  <i className="ti ti-download text-[13px] mr-1" />{downloadingType === form.formType ? 'Preparing…' : 'Download CSV'}
                </Button>
                {form.openPath ? (
                  <a
                    href={`${VOLUNTEER_PORTAL_BASE}${form.openPath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12.5px] font-bold text-brand hover:underline whitespace-nowrap"
                  >
                    Open Form <i className="ti ti-external-link text-[11px]" />
                  </a>
                ) : null}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between gap-4 py-[16px]">
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-text">{MENTOR_FORM.title}</div>
              <div className="text-[12px] text-muted mt-[3px]">{MENTOR_FORM.description}</div>
            </div>
            <div className="text-[11.5px] text-muted italic shrink-0">External form -- no data to display</div>
          </div>
        </div>
      </Card>

      <FormResponseModal formType={viewing?.formType ?? null} title={viewing?.title ?? ''} onClose={() => setViewing(null)} />
    </>
  );
}
