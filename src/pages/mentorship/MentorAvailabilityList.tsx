import { useState } from 'react';
import type { Mentor } from '../../types/database';
import { StatusPill } from '../../components/StatusPill';
import { ConfirmModal } from '../../components/ConfirmModal';

const COLOR_PALETTE = ['#245ec2', '#10b981', '#7db9ff', '#f59e0b', '#ff5961', '#14224a'];

function colorFor(index: number): string {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

function initialsFor(name: string | null): string {
  const parts = (name || '').trim().split(/\s+/);
  let initials = '';
  for (let i = 0; i < parts.length && initials.length < 2; i++) {
    if (parts[i][0]) { initials += parts[i][0].toUpperCase(); }
  }
  return initials || 'M';
}

interface MentorAvailabilityListProps {
  mentors: Mentor[];
  searchQuery: string;
  onSetAvailability: (mentorId: string, available: boolean) => void;
  onEdit: (mentor: Mentor) => void;
}

export function MentorAvailabilityList({ mentors, searchQuery, onSetAvailability, onEdit }: MentorAvailabilityListProps) {
  const [confirmMentor, setConfirmMentor] = useState<Mentor | null>(null);

  const query = searchQuery.trim().toLowerCase();
  const visible = mentors.filter((m) => (m.name || '').toLowerCase().includes(query));

  function handleToggleClick(mentor: Mentor) {
    if (mentor.available) {
      // Turning OFF requires confirmation, same as the original design.
      setConfirmMentor(mentor);
    } else {
      // Turning ON is immediate.
      onSetAvailability(mentor.id, true);
    }
  }

  return (
    <>
      <div className="grid grid-cols-[2.4fr_1fr_1fr_1.2fr] gap-[14px] items-center py-[14px] border-b border-border [&>div]:text-[11px] [&>div]:font-bold [&>div]:text-muted [&>div]:uppercase [&>div]:tracking-[0.05em]">
        <div>Mentor</div>
        <div>Calendly Link</div>
        <div>Status</div>
        <div>Available</div>
      </div>

      <div>
        {mentors.map((mentor, i) => {
          if (!visible.includes(mentor)) { return null; }

          return (
            <div key={mentor.id} className="grid grid-cols-[2.4fr_1fr_1fr_1.2fr] gap-[14px] items-center py-[14px] border-b border-border last:border-b-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-[38px] h-[38px] rounded-full flex items-center justify-center font-semibold text-[13px] text-white shrink-0"
                  style={{ background: colorFor(i) }}
                >
                  {initialsFor(mentor.name)}
                </div>
                <div className="text-[13px] font-semibold text-text">{mentor.name || 'Unknown'}</div>
              </div>
              <div className="text-[11.5px] flex items-center gap-[10px]">
                {mentor.calendly_link ? (
                  <a
                    href={mentor.calendly_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand font-semibold hover:underline"
                  >
                    Link
                  </a>
                ) : (
                  <span className="text-muted">-</span>
                )}
                <button
                  onClick={() => onEdit(mentor)}
                  className="text-[11.5px] font-bold text-brand bg-none border-none cursor-pointer font-sans hover:underline"
                >
                  Edit
                </button>
              </div>
              <div>
                <StatusPill variant={mentor.available ? 'success' : 'warning'}>
                  {mentor.available ? 'Available' : 'Unavailable'}
                </StatusPill>
              </div>
              <div className="flex items-center gap-[9px]">
                <div
                  onClick={() => handleToggleClick(mentor)}
                  className={`relative w-11 h-6 rounded-[14px] cursor-pointer transition-colors duration-200 shrink-0 ${mentor.available ? 'bg-success' : 'bg-toggle-off'}`}
                >
                  <div
                    className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-[left] duration-200"
                    style={{ left: mentor.available ? 23 : 3 }}
                  />
                </div>
                <span className={`text-[12px] font-bold ${mentor.available ? 'text-success' : 'text-muted'}`}>
                  {mentor.available ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-6 text-muted text-[13px]">No mentors found.</div>
      ) : null}

      <ConfirmModal
        open={confirmMentor !== null}
        title="Turn off booking?"
        text={`Are you sure you want to turn 1:1 booking off for ${confirmMentor?.name || 'this mentor'}?`}
        onCancel={() => setConfirmMentor(null)}
        onConfirm={() => {
          if (confirmMentor) { onSetAvailability(confirmMentor.id, false); }
          setConfirmMentor(null);
        }}
      />
    </>
  );
}
