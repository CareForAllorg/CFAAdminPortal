import { formatDate } from '../../utils/formatDate';
import type { MentorApplication } from './useMentorApplications';

interface MentorApplicationsListProps {
  applications: MentorApplication[];
  onSetStatus: (id: string, status: 'approved' | 'rejected') => void;
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) { return null; }
  return (
    <div className="flex flex-wrap gap-[6px] mt-[6px]">
      {items.map((item) => (
        <span key={item} className="text-[10.5px] font-bold px-[9px] py-[3px] rounded-full bg-hover-tint text-brand">
          {item}
        </span>
      ))}
    </div>
  );
}

export function MentorApplicationsList({ applications, onSetStatus }: MentorApplicationsListProps) {
  if (applications.length === 0) {
    return <div className="text-[12.5px] text-muted">No pending mentor applications.</div>;
  }

  return (
    <div className="flex flex-col gap-[12px]">
      {applications.map((app) => (
        <div key={app.id} className="bg-card border border-border rounded-xl px-5 py-[16px]">
          <div className="flex items-start justify-between gap-[14px] flex-wrap mb-[10px]">
            <div>
              <div className="text-[14px] font-bold text-text mb-[2px]">{app.full_name}</div>
              <div className="text-[12px] text-muted">{app.email}{app.location ? ` · ${app.location}` : ''}</div>
              <div className="text-[11px] text-muted mt-[2px]">Submitted {formatDate(app.submitted_at, '—')}</div>
            </div>
            <div className="flex items-center gap-[10px] shrink-0">
              <button
                onClick={() => onSetStatus(app.id, 'rejected')}
                className="text-[12.5px] font-bold text-accent bg-none border-none cursor-pointer font-sans hover:underline"
              >
                Reject
              </button>
              <button
                onClick={() => onSetStatus(app.id, 'approved')}
                className="text-[12.5px] font-bold text-brand bg-none border-none cursor-pointer font-sans hover:underline"
              >
                Approve
              </button>
            </div>
          </div>

          {app.bio ? <div className="text-[12.5px] text-text leading-[1.5] mb-[8px]">{app.bio}</div> : null}

          {app.calendly_link ? (
            <div className="text-[11.5px] mb-[6px]">
              <a href={app.calendly_link} target="_blank" rel="noopener noreferrer" className="text-brand font-semibold hover:underline">
                Calendly link
              </a>
            </div>
          ) : null}

          <TagList items={app.professional_background} />
          <TagList items={app.can_help_with} />
          <TagList items={app.comfortable_mentoring} />
        </div>
      ))}
    </div>
  );
}
