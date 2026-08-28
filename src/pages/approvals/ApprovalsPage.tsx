import { useState } from 'react';
import { Topbar } from '../../components/Topbar';
import { StatCard } from '../../components/StatCard';
import { Tabs } from '../../components/Tabs';
import { useApprovalStats } from './useApprovalStats';
import { ProjectSubmissionsTab } from './ProjectSubmissionsTab';
import { MappingSubmissionsTab } from './MappingSubmissionsTab';
import { VerificationTab } from './VerificationTab';
import { ProjectPhotosTab } from './ProjectPhotosTab';

type ApprovalTab = 'projects' | 'mapping' | 'verification' | 'photos';

export function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<ApprovalTab>('projects');
  const [refreshKey, setRefreshKey] = useState(0);
  const stats = useApprovalStats(refreshKey);
  const bumpStats = () => setRefreshKey((k) => k + 1);

  return (
    <>
      <Topbar title="Service Hour Approvals" />

      <div className="grid grid-cols-3 max-portal:grid-cols-2 gap-[14px]">
        <StatCard label="Total Service Hours" value={Math.round(stats.totalHours).toLocaleString()} />
        <StatCard label="Pending Approvals" value={stats.pendingCount ?? '—'} valueClassName="text-warning" />
        <StatCard
          label="Verification Requests"
          value={stats.verifTotal ?? '—'}
          sub={stats.verifIncomplete != null ? `${stats.verifIncomplete} incomplete` : undefined}
          subClassName="text-warning"
        />
      </div>

      <Tabs
        tabs={[
          { id: 'projects', label: 'Project & Impact Hour Submissions' },
          { id: 'mapping', label: 'Mapping & Mapathon Submissions' },
          { id: 'verification', label: 'Service Hour Verification' },
          { id: 'photos', label: 'Project Photos' },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as ApprovalTab)}
      />

      {activeTab === 'projects' ? <ProjectSubmissionsTab onMutated={bumpStats} /> : null}
      {activeTab === 'mapping' ? <MappingSubmissionsTab onMutated={bumpStats} /> : null}
      {activeTab === 'verification' ? <VerificationTab onMutated={bumpStats} /> : null}
      {activeTab === 'photos' ? <ProjectPhotosTab /> : null}
    </>
  );
}
