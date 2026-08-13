import { useState } from 'react';
import { Topbar } from '../../components/Topbar';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { formatDate } from '../../utils/formatDate';
import { useImpactEvents } from './useImpactEvents';
import { metricList } from './metrics';
import { MetricCardGrid } from './MetricCardGrid';
import { MetricLineChart } from './MetricLineChart';
import { useMapathonDates, type MapathonDate } from '../resources/useMapathonDates';
import { MapathonDateEditModal } from '../resources/MapathonDateEditModal';

export function ImpactPage() {
  const events = useImpactEvents();
  const [selectedMetric, setSelectedMetric] = useState('totalmembers');

  const metrics = events ? metricList(events) : [];
  const metric = metrics.find((m) => m.key === selectedMetric);

  const { dates, createDate, updateDate, deleteDate, uploadAttendance } = useMapathonDates();
  const [dateEditItem, setDateEditItem] = useState<MapathonDate | null>(null);
  const [dateAddOpen, setDateAddOpen] = useState(false);
  const [deleteDateItem, setDeleteDateItem] = useState<MapathonDate | null>(null);

  async function handleConfirmDeleteDate() {
    if (!deleteDateItem) { return; }
    await deleteDate(deleteDateItem.id);
    setDeleteDateItem(null);
  }

  return (
    <>
      <Topbar title="Impact Measurables" />

      <Card>
        <div className="text-[14px] font-bold text-text mb-4 flex items-center gap-2">
          <i className="ti ti-click text-muted text-[17px]" /> Select a Measurable
        </div>
        <div className="text-[12.5px] text-muted mb-4 leading-[1.5]">
          Click a metric below to view its trend chart, with Month / Year options.
        </div>
        <MetricCardGrid metrics={metrics} selectedKey={selectedMetric} onSelect={setSelectedMetric} />
      </Card>

      <MetricLineChart metric={metric} />

      <Card>
        <div className="flex items-center justify-between flex-wrap gap-[10px] mb-[6px]">
          <div className="font-heading text-[16px] text-text tracking-[0.01em] flex items-center gap-[9px]">
            <i className="ti ti-calendar-event" /> Mapathon Publishing
          </div>
          <Button variant="primary" className="!text-[12px] !px-4 !py-2" onClick={() => setDateAddOpen(true)}>
            <i className="ti ti-plus text-[12px] mr-1" />Add Date
          </Button>
        </div>
        <div className="text-[12.5px] text-muted mb-[18px]">
          Publish each mapathon's self-reported totals and attendance list here -- the Buildings Mapped / Roads Mapped cards above add these on top of member submissions.
        </div>

        {dates.length === 0 ? (
          <div className="text-[12.5px] text-muted">No mapathon dates configured yet.</div>
        ) : dates.map((d) => (
          <div key={d.id} className="bg-card border border-border rounded-xl px-5 py-[14px] mb-[10px] last:mb-0 flex items-center justify-between gap-[14px] flex-wrap">
            <div>
              <div className="text-[14px] font-bold text-text mb-[2px]">{formatDate(d.event_date, '—')}{d.label ? ` — ${d.label}` : ''}</div>
              <div className="text-[12px] text-muted">{d.hours} hour{d.hours === 1 ? '' : 's'} credited</div>
              {(d.total_buildings_mapped > 0 || d.total_km_roads_mapped > 0 || d.bonus_service_hours > 0) ? (
                <div className="text-[12px] text-muted mt-[3px]">
                  {d.total_buildings_mapped} buildings · {d.total_km_roads_mapped} km roads · {d.bonus_service_hours} bonus hour{d.bonus_service_hours === 1 ? '' : 's'}
                </div>
              ) : null}
              <div className="mt-[7px]">
                {d.attendance_list_path ? (
                  <span className="text-[10.5px] font-bold px-[10px] py-[3px] rounded-full uppercase tracking-[0.03em] bg-success-light text-success-dark">
                    Attendance list attached
                  </span>
                ) : (
                  <span className="text-[10.5px] font-bold px-[10px] py-[3px] rounded-full uppercase tracking-[0.03em] bg-bg text-muted border border-border">
                    No attendance list
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-[14px] shrink-0">
              <button onClick={() => setDateEditItem(d)} className="text-[12.5px] font-bold text-brand bg-none border-none cursor-pointer font-sans hover:underline">Edit</button>
              <button onClick={() => setDeleteDateItem(d)} className="text-[12.5px] font-bold text-accent bg-none border-none cursor-pointer font-sans hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </Card>

      <MapathonDateEditModal
        open={dateEditItem !== null}
        item={dateEditItem}
        onClose={() => setDateEditItem(null)}
        onSave={(payload) => updateDate(dateEditItem!.id, payload)}
        onUploadAttendance={uploadAttendance}
      />
      <MapathonDateEditModal
        open={dateAddOpen}
        item={null}
        onClose={() => setDateAddOpen(false)}
        onSave={createDate}
        onUploadAttendance={uploadAttendance}
      />
      <ConfirmModal
        open={deleteDateItem !== null}
        title="Delete mapathon date?"
        text={`Are you sure you want to remove ${deleteDateItem ? formatDate(deleteDateItem.event_date, '') : ''}? This can't be undone.`}
        onCancel={() => setDeleteDateItem(null)}
        onConfirm={handleConfirmDeleteDate}
      />
    </>
  );
}
