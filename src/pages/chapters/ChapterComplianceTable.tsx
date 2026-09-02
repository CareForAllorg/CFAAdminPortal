import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { StatusPill } from '../../components/StatusPill';
import { Button } from '../../components/Button';
import { formatDate } from '../../utils/formatDate';
import type { EnrichedChapter, Quarter, QuarterStatus } from './useChapterData';

interface ChapterComplianceTableProps {
  chapters: EnrichedChapter[];
  currentYear: number;
  onMarkQuarterComplete: (chapterName: string, quarter: Quarter) => void;
  onUnmarkQuarterComplete: (checkinId: string) => void;
  onSetProjectCount: (chapterId: string, value: number | null) => void;
  removingCheckinId: string | null;
}

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

const DOT_CLASS: Record<QuarterStatus, string> = {
  done: 'bg-success-light text-success-dark',
  overdue: 'bg-danger-light text-danger-dark',
  pending: 'bg-border text-muted',
};

const DOT_TITLE: Record<QuarterStatus, string> = {
  done: 'Submitted',
  overdue: 'Overdue',
  pending: 'Not yet due',
};

// All four Likert questions on the volunteer portal's check-in form use
// a 1-5 scale (confirmed against the live form itself, not assumed).
function formatRating(value: number | null): string {
  return value != null ? `${value} / 5` : '-';
}

export function ChapterComplianceTable({
  chapters,
  currentYear,
  onMarkQuarterComplete,
  onUnmarkQuarterComplete,
  onSetProjectCount,
  removingCheckinId,
}: ChapterComplianceTableProps) {
  const [openChapterId, setOpenChapterId] = useState<string | null>(null);
  const [projectCountInput, setProjectCountInput] = useState('');

  const sorted = [...chapters].sort((a, b) => (a.compliant ? 1 : 0) - (b.compliant ? 1 : 0));
  const openChapter = chapters.find((c) => c.id === openChapterId) ?? null;

  useEffect(() => {
    if (openChapter) { setProjectCountInput(String(openChapter.projectCount)); }
  }, [openChapter?.id]);

  return (
    <>
      <div className="grid grid-cols-[1.3fr_1.2fr_1fr_1fr_1fr_1fr] gap-3 items-center py-[14px] border-b border-border [&>div]:text-[11px] [&>div]:font-bold [&>div]:text-muted [&>div]:uppercase [&>div]:tracking-[0.05em]">
        <div>Chapter</div>
        <div>Chapter Lead</div>
        <div>Projects (2+/yr)</div>
        <div>Quarterly Check-Ins</div>
        <div>Onboarding Video</div>
        <div>Status</div>
      </div>

      <div>
        {sorted.map((ch) => (
          <div key={ch.id} className="grid grid-cols-[1.3fr_1.2fr_1fr_1fr_1fr_1fr] gap-3 items-center py-[14px] border-b border-border last:border-b-0">
            <div className="text-[13px] font-semibold text-text">{ch.name}</div>
            <div className="text-[11.5px] text-muted">{ch.lead}</div>

            <div
              onClick={() => setOpenChapterId(ch.id)}
              className="inline-flex items-center gap-[7px] text-[12px] font-semibold text-text cursor-pointer hover:opacity-80"
            >
              <span className={`w-[10px] h-[10px] rounded-full shrink-0 ${ch.projectCount >= 2 ? 'bg-success' : 'bg-accent'}`} />
              {ch.projectCount} / 2
            </div>

            {ch.isPartner ? (
              <div className="text-[11.5px] text-muted italic" title="Program partners don't submit quarterly check-ins">
                N/A — partner org
              </div>
            ) : (
              <div onClick={() => setOpenChapterId(ch.id)} className="flex gap-[5px] cursor-pointer [&:hover>div]:opacity-80">
                {ch.quarterStatuses.map((status, i) => (
                  <div
                    key={i}
                    title={DOT_TITLE[status]}
                    className={`w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-[10px] font-bold ${DOT_CLASS[status]}`}
                  >
                    Q{i + 1}
                  </div>
                ))}
              </div>
            )}
            <div title="Self-reported by the chapter lead in their Onboarding Checklist -- not verified watch tracking">
              <StatusPill variant={ch.onboardingChecklist[0] ? 'success' : 'neutral'}>
                {ch.onboardingChecklist[0] ? 'Watched' : 'Not yet'}
              </StatusPill>
            </div>
            <div>
              <StatusPill variant={ch.compliant ? 'success' : 'danger'}>
                {ch.compliant ? 'Compliant' : 'Non-Compliant'}
              </StatusPill>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={openChapter !== null}
        onClose={() => setOpenChapterId(null)}
        title="Quarterly Check-In Responses"
        subtitle={openChapter?.name}
      >
        {openChapter ? (
          <div className="py-[11px] border-b border-border flex items-center justify-between gap-3">
            <div>
              <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">Project Count</div>
              <div className="text-[11px] text-muted mt-1">
                Completed projects this year (2+ required for compliance)
                {openChapter.projectCountOverride != null ? ' — manually set' : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={projectCountInput}
                onChange={(e) => setProjectCountInput(e.target.value)}
                className="w-16 rounded-md border border-border px-2 py-[5px] text-[13px] text-text"
              />
              <Button
                variant="outline"
                className="!text-[11px] !px-3 !py-[5px]"
                onClick={() => onSetProjectCount(openChapter.id, Number(projectCountInput))}
              >
                Save
              </Button>
              {openChapter.projectCountOverride != null ? (
                <Button
                  variant="danger"
                  className="!text-[11px] !px-3 !py-[5px]"
                  onClick={() => onSetProjectCount(openChapter.id, null)}
                >
                  Reset
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {openChapter
          ? QUARTERS.map((q) => {
              // Same fix as api/_lib/compliance.ts: the volunteer portal
              // stores quarter as "Q1 (Jan - Mar)", not bare "Q1".
              const submitted = openChapter.checkins.find(
                (c) => (c.quarter || '').trim().startsWith(q) && !!c.submitted_at && new Date(c.submitted_at).getFullYear() === currentYear
              );

              return (
                <div key={q} className="py-[11px] border-b border-border last:border-b-0">
                  <div className="flex items-center justify-between gap-3 mb-[6px]">
                    <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">
                      {q} {currentYear}
                      {submitted ? ` — Submitted ${formatDate(submitted.submitted_at)}` : ' — Not submitted'}
                    </div>
                    {submitted ? (
                      <Button
                        variant="danger"
                        className="!text-[11px] !px-3 !py-[5px]"
                        disabled={removingCheckinId === submitted.id}
                        onClick={() => onUnmarkQuarterComplete(submitted.id)}
                      >
                        {removingCheckinId === submitted.id ? 'Removing…' : 'Remove'}
                      </Button>
                    ) : (
                      <Button variant="outline" className="!text-[11px] !px-3 !py-[5px]" onClick={() => onMarkQuarterComplete(openChapter.name, q)}>
                        Mark Complete
                      </Button>
                    )}
                  </div>
                  {submitted ? (
                    <div className="text-[14px] text-text flex flex-col gap-[3px]">
                      <div><strong>Member Count:</strong> {submitted.member_count != null ? submitted.member_count : '-'}</div>
                      <div><strong>Total Hours:</strong> {submitted.total_hours != null ? submitted.total_hours : '-'}</div>
                      <div><strong>Activities:</strong> {submitted.activities || '-'}</div>
                      <div><strong>Meeting Helpfulness</strong> (Not Helpful at All → Extremely Helpful): {formatRating(submitted.meeting_helpfulness)}</div>
                      <div><strong>Guidance &amp; Resources Provided</strong> (Strongly Disagree → Strongly Agree): {formatRating(submitted.guidance_rating)}</div>
                      <div><strong>Increased Understanding of Healthcare Challenges</strong> (Strongly Disagree → Strongly Agree): {formatRating(submitted.understanding_rating)}</div>
                      <div><strong>Meaningful Community Engagement</strong> (Strongly Disagree → Strongly Agree): {formatRating(submitted.community_engagement_rating)}</div>
                      <div><strong>Community Guidelines Compliance:</strong> {submitted.guidelines_compliance || '-'}</div>
                      <div><strong>Structural Changes:</strong> {submitted.structural_changes || '-'}</div>
                      <div><strong>Challenges:</strong> {submitted.challenges || '-'}</div>
                    </div>
                  ) : null}
                </div>
              );
            })
          : null}
      </Modal>
    </>
  );
}
