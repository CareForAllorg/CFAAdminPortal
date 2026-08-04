import { useState } from 'react';
import { Topbar } from '../../components/Topbar';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { SearchBar } from '../../components/SearchBar';
import { Button } from '../../components/Button';
import { useChapterData } from './useChapterData';
import { useChapterApplications } from './useChapterApplications';
import { ChapterApplications } from './ChapterApplications';
import { CheckinDeadlinesForm } from './CheckinDeadlinesForm';
import { ChapterComplianceTable } from './ChapterComplianceTable';
import { ChapterDirectory } from './ChapterDirectory';

export function ChaptersPage() {
  const { enriched, deadlines, currentYear, reload, markQuarterComplete, unmarkQuarterComplete, setProjectCountOverride } = useChapterData();
  const { applications, loading: applicationsLoading, approve, reject } = useChapterApplications();
  const [search, setSearch] = useState('');

  const compliantCount = enriched.filter((c) => c.compliant).length;

  return (
    <>
      <Topbar title="Chapters" />

      <div className="grid grid-cols-3 max-portal:grid-cols-2 gap-[14px]">
        <StatCard label="Total Chapters" value={enriched.length} />
        <StatCard label="Compliant" value={compliantCount} valueClassName="text-success" />
        <StatCard label="Non-Compliant" value={enriched.length - compliantCount} valueClassName="text-accent" />
      </div>

      <ChapterApplications applications={applications} loading={applicationsLoading} onApprove={approve} onReject={reject} />

      <Card>
        <div className="text-[14px] font-bold text-text mb-4 flex items-center gap-2">
          <i className="ti ti-calendar-due text-muted text-[17px]" /> Quarterly Check-In Deadlines
        </div>
        <div className="text-[12.5px] text-muted mb-[18px] leading-[1.5]">
          Set a due date for each quarter. A chapter's check-in is marked overdue once its due date passes with no submission on file.
        </div>
        <CheckinDeadlinesForm deadlines={deadlines} year={currentYear} onSaved={reload} />
      </Card>

      <Card>
        <div className="text-[14px] font-bold text-text mb-4 flex items-center gap-2">
          <i className="ti ti-building-community text-muted text-[17px]" /> Chapter Annual Activity Compliance
        </div>
        <div className="text-[12.5px] text-muted mb-[18px] leading-[1.5]">
          To remain an active chapter, a chapter must complete at least 2 projects per year and submit all 4 quarterly check-in forms. Non-compliant chapters are sorted to the top. Click a chapter's check-in dots to view its submitted responses.
        </div>
        <ChapterComplianceTable
          chapters={enriched}
          currentYear={currentYear}
          onMarkQuarterComplete={markQuarterComplete}
          onUnmarkQuarterComplete={unmarkQuarterComplete}
          onSetProjectCount={setProjectCountOverride}
        />
        <Button variant="outline" className="w-full mt-[13px] !text-[12px] !px-2 !py-2">View All Chapters</Button>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[14px] font-bold text-text flex items-center gap-2">
            <i className="ti ti-list-check text-muted text-[17px]" /> All Chapters
          </div>
          <SearchBar value={search} onChange={setSearch} placeholder="Search chapters..." className="w-[220px]" />
        </div>
        <div className="text-[12px] text-muted mb-4 leading-[1.5]">
          Region, Lead, and Onboarding Steps aren't tracked in the database yet -- shown as — until that data exists.
        </div>
        <ChapterDirectory chapters={enriched} searchQuery={search} />
      </Card>
    </>
  );
}
