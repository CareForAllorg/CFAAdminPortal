import { useState } from 'react';
import { Topbar } from '../../components/Topbar';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { SearchBar } from '../../components/SearchBar';
import { Button } from '../../components/Button';
import { useMentors, type MentorWithAvatar } from './useMentors';
import { useMentorApplications } from './useMentorApplications';
import { MentorAvailabilityList } from './MentorAvailabilityList';
import { MentorApplicationsList } from './MentorApplicationsList';
import { AddMentorModal } from './AddMentorModal';
import { MentorEditModal } from './MentorEditModal';

export function MentorshipPage() {
  const { mentors, sessionCount, unlistedMentorProfiles, setMentorAvailability, updateMentor, uploadMentorAvatar, removeMentorAvatar, addMentor } = useMentors();
  const { pending: pendingApplications, setApplicationStatus } = useMentorApplications();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<MentorWithAvatar | null>(null);

  const availableCount = mentors.filter((m) => m.available).length;

  return (
    <>
      <Topbar title="Mentorship" />

      <div className="grid grid-cols-4 max-portal:grid-cols-2 gap-[14px]">
        <StatCard label="Total Mentors" value={mentors.length} />
        <StatCard label="Available for Booking" value={availableCount} valueClassName="text-success" />
        <StatCard label="Unavailable" value={mentors.length - availableCount} valueClassName="text-muted" />
        <StatCard label="Total Sessions" value={sessionCount ?? '—'} />
      </div>

      <Card>
        <div className="flex items-center justify-between flex-wrap gap-[10px] mb-[6px]">
          <div className="text-[14px] font-bold text-text flex items-center gap-2">
            <i className="ti ti-user-plus text-muted text-[17px]" /> Pending Mentor Applications
            {pendingApplications.length > 0 ? (
              <span className="text-[11px] font-bold px-[9px] py-[2px] rounded-full bg-hover-tint text-brand">{pendingApplications.length}</span>
            ) : null}
          </div>
        </div>
        <div className="text-[12.5px] text-muted mb-[18px] leading-[1.5]">
          Submissions from the "Become a Mentor" form. Approving here only marks the application reviewed -- creating the actual mentor account and booking-availability entry is still a manual step for now.
        </div>

        <MentorApplicationsList applications={pendingApplications} onSetStatus={setApplicationStatus} />
      </Card>

      <Card>
        <div className="flex items-center justify-between flex-wrap gap-[10px] mb-[6px]">
          <div className="text-[14px] font-bold text-text flex items-center gap-2">
            <i className="ti ti-toggle-right text-muted text-[17px]" /> Mentor Booking Availability
          </div>
          <Button variant="primary" className="!text-[12px] !px-4 !py-2" onClick={() => setAddOpen(true)}>
            <i className="ti ti-plus text-[12px] mr-1" />Add Mentor
          </Button>
        </div>
        <div className="text-[12.5px] text-muted mb-[18px] leading-[1.5]">
          Toggle a mentor ON to let members click "Book Session" and reach their Calendly link. Turning a mentor OFF requires confirmation.
        </div>

        <SearchBar value={search} onChange={setSearch} placeholder="Search mentors by name..." className="mb-[14px]" />

        <MentorAvailabilityList mentors={mentors} searchQuery={search} onSetAvailability={setMentorAvailability} onEdit={setEditItem} />
      </Card>

      <AddMentorModal open={addOpen} profiles={unlistedMentorProfiles} onClose={() => setAddOpen(false)} onAdd={addMentor} />
      <MentorEditModal
        item={editItem}
        onClose={() => setEditItem(null)}
        onSave={updateMentor}
        onUploadAvatar={uploadMentorAvatar}
        onRemoveAvatar={removeMentorAvatar}
      />
    </>
  );
}
