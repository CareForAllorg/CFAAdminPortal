import { useState } from 'react';
import { Card } from '../../components/Card';
import { MetricCardGrid } from './MetricCardGrid';
import { MetricLineChart } from './MetricLineChart';
import { mentorMetricList } from './mentorMetrics';
import { useMentorStats, type CountHours } from './useMentorStats';

const fmtHours = (h: number) => `${h} hr${h === 1 ? '' : 's'}`;
const cell = (c: CountHours) => (c.count === 0 ? '—' : `${c.count} · ${fmtHours(c.hours)}`);
const GRID = 'grid-cols-[1.5fr_1fr_1.2fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr]';

// The Mentors side of Impact Measurables: identical card grid + trend chart
// to the Overall view, fed by approved mentor submissions, with a
// per-mentor breakdown underneath.
export function MentorImpactView() {
  const { stats, loading } = useMentorStats();
  const [selectedMetric, setSelectedMetric] = useState('office-sessions');

  const metrics = mentorMetricList(stats);
  const metric = metrics.find((m) => m.key === selectedMetric);
  const { mentors, totals } = stats;

  return (
    <>
      <Card>
        <div className="text-[14px] font-bold text-text mb-4 flex items-center gap-2">
          <i className="ti ti-click text-muted text-[17px]" /> Select a Mentor Measurable
        </div>
        <div className="text-[12.5px] text-muted mb-4 leading-[1.5]">
          Approved mentor submissions only. Click a measurable to view its trend chart, with Month / Year options.
        </div>
        <MetricCardGrid metrics={metrics} selectedKey={selectedMetric} onSelect={setSelectedMetric} />
        {!loading && totals.other.count > 0 ? (
          <div className="text-[12px] text-muted mt-4 leading-[1.5]">
            {totals.other.count} approved log{totals.other.count === 1 ? '' : 's'} by mentors ({fmtHours(totals.other.hours)}) didn't match a category above and aren't counted: {totals.other.types.join(', ')}.
          </div>
        ) : null}
      </Card>

      <MetricLineChart metric={metric} />

      <Card>
        <div className="text-[14px] font-bold text-text mb-4 flex items-center gap-2">
          <i className="ti ti-users text-muted text-[17px]" /> By Mentor
        </div>
        <div className={`grid ${GRID} gap-[10px] items-center py-3 border-b border-border [&>div]:text-[11px] [&>div]:font-bold [&>div]:text-muted [&>div]:uppercase [&>div]:tracking-[0.05em]`}>
          <div>Mentor</div>
          <div>Office Hours</div>
          <div>Impact & Check-Ins</div>
          <div>Curriculum</div>
          <div>Resource</div>
          <div>Workshop</div>
          <div>Letters</div>
          <div>Infographic</div>
          <div>Other</div>
        </div>
        {loading ? (
          <div className="text-center py-6 text-muted text-[13px]">Loading...</div>
        ) : mentors.length === 0 ? (
          <div className="text-center py-6 text-muted text-[13px]">No mentors found.</div>
        ) : (
          mentors.map((m) => (
            <div key={m.userId ?? m.name} className={`grid ${GRID} gap-[10px] items-center py-3 border-b border-border last:border-b-0 text-[12.5px] text-text`}>
              <div className="font-semibold">{m.name}</div>
              <div>{cell(m.office)}</div>
              <div>{cell(m.impact)}</div>
              <div>{cell(m.curriculum)}</div>
              <div>{m.curriculum.stencils.resource || '—'}</div>
              <div>{m.curriculum.stencils.workshop || '—'}</div>
              <div>{m.curriculum.stencils.letter || '—'}</div>
              <div>{m.curriculum.stencils.infographic || '—'}</div>
              <div>{cell(m.other)}</div>
            </div>
          ))
        )}
      </Card>
    </>
  );
}
