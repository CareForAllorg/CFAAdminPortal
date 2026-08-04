import { useState } from 'react';
import { Topbar } from '../../components/Topbar';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { SegmentedToggle } from '../../components/SegmentedToggle';
import { SearchBar } from '../../components/SearchBar';
import { MemberProfileModal } from '../../components/MemberProfileModal';
import { ChapterProfileModal } from '../../components/ChapterProfileModal';
import { PartnerProfileModal } from '../../components/PartnerProfileModal';
import { useOverviewStats } from './useOverviewStats';
import { HoursChart } from './HoursChart';
import { HoursPieChart } from './HoursPieChart';
import { useIndividualLeaderboard } from './useIndividualLeaderboard';
import { useChapterLeaderboard } from './useChapterLeaderboard';
import { LeaderboardList } from './LeaderboardList';

export function OverviewPage() {
  const stats = useOverviewStats();
  const { ranked: individuals } = useIndividualLeaderboard();
  const { ranked: chapters } = useChapterLeaderboard();
  const [leaderboardView, setLeaderboardView] = useState<'individuals' | 'groups'>('individuals');
  const [search, setSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  function handleGroupRowClick(id: string) {
    const row = chapters.find((c) => c.id === id);
    if (!row) { return; }
    if (row.type === 'Partner') { setSelectedPartnerId(id); } else { setSelectedChapterId(id); }
  }

  return (
    <>
      <Topbar title="Admin Overview" showUserChip />

      <div className="grid grid-cols-2 gap-[14px]">
        <StatCard
          label="Total Chapters"
          value={stats.chapterCount ?? '—'}
          sub="7 non-compliant"
          subClassName="text-accent"
        />
        <StatCard
          label="Total Members"
          value={stats.memberCount ?? '—'}
          sub={stats.newMemberCount != null ? `+${stats.newMemberCount} new members in last 30 days` : undefined}
        />
      </div>

      <div className="grid grid-cols-2 max-portal:grid-cols-1 gap-[18px]">
        <HoursChart />
        <HoursPieChart />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="text-[14px] font-bold text-text flex items-center gap-2">
            <i className="ti ti-trophy text-muted text-[17px]" /> Service Hours Leaderboard
          </div>
          <SegmentedToggle
            options={[{ value: 'individuals', label: 'Members & Mentors' }, { value: 'groups', label: 'Chapters & Partners' }]}
            value={leaderboardView}
            onChange={setLeaderboardView}
          />
        </div>

        <SearchBar value={search} onChange={setSearch} placeholder="Search leaderboard by name..." className="mb-[14px]" />

        <LeaderboardList
          rows={individuals.map((r) => ({ name: r.name, meta: r.chapter, hours: r.hours, id: r.userId }))}
          searchQuery={search}
          nameColumnLabel="Member"
          metaColumnLabel="Chapter"
          visible={leaderboardView === 'individuals'}
          onRowClick={setSelectedMemberId}
        />
        <LeaderboardList
          rows={chapters.map((r) => ({ name: r.name, meta: r.type, hours: r.hours, id: r.id }))}
          searchQuery={search}
          nameColumnLabel="Chapter / Partner"
          metaColumnLabel="Type"
          visible={leaderboardView === 'groups'}
          onRowClick={handleGroupRowClick}
        />
      </Card>

      <MemberProfileModal profileId={selectedMemberId} onClose={() => setSelectedMemberId(null)} />
      <ChapterProfileModal chapterId={selectedChapterId} onClose={() => setSelectedChapterId(null)} />
      <PartnerProfileModal partnerId={selectedPartnerId} onClose={() => setSelectedPartnerId(null)} />
    </>
  );
}
