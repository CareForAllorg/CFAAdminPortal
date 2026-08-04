import { useState } from 'react';
import { Button } from '../../components/Button';

const PREVIEW_SIZE = 6;

function rankBadgeClass(rank: number): string {
  if (rank === 1) { return 'bg-rank-gold'; }
  if (rank === 2) { return 'bg-rank-silver'; }
  if (rank === 3) { return 'bg-rank-bronze'; }
  return 'bg-brand';
}

interface LeaderboardListProps {
  rows: { name: string; meta: string; hours: number; id?: string | null }[];
  searchQuery: string;
  nameColumnLabel: string;
  metaColumnLabel: string;
  visible: boolean;
  onRowClick?: (id: string) => void;
}

// Row-click behavior (opening a profile modal) is owned by the caller now
// -- individuals open a MemberProfileModal, chapters/partners open a
// Chapter or Partner one depending on row.meta, and this component doesn't
// need to know which.
export function LeaderboardList({ rows, searchQuery, nameColumnLabel, metaColumnLabel, visible, onRowClick }: LeaderboardListProps) {
  const [expanded, setExpanded] = useState(false);

  const query = searchQuery.trim().toLowerCase();
  const matching = rows.filter((r) => r.name.toLowerCase().includes(query));
  const shown = expanded ? matching : matching.slice(0, PREVIEW_SIZE);
  const disableViewFull = rows.length <= PREVIEW_SIZE;

  return (
    <div style={{ display: visible ? 'block' : 'none' }}>
      <div className="grid grid-cols-[36px_2fr_1fr_1fr] gap-3 items-center pb-[9px] border-b border-border [&>div]:text-[11px] [&>div]:font-bold [&>div]:text-muted [&>div]:uppercase [&>div]:tracking-[0.05em]">
        <div />
        <div>{nameColumnLabel}</div>
        <div>{metaColumnLabel}</div>
        <div>Hours</div>
      </div>

      <div>
        {shown.map((row, idx) => {
          const rank = idx + 1;
          const clickable = Boolean(row.id && onRowClick);
          return (
            <div
              key={row.name}
              onClick={clickable ? () => onRowClick!(row.id as string) : undefined}
              className={`grid grid-cols-[36px_2fr_1fr_1fr] gap-3 items-center py-[11px] border-b border-border last:border-b-0 rounded-lg transition-colors duration-150 hover:bg-bg ${clickable ? 'cursor-pointer' : ''}`}
            >
              <div className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-[12px] font-bold text-white ${rankBadgeClass(rank)}`}>
                {rank}
              </div>
              <div className="text-[13px] font-semibold text-text">{row.name}</div>
              <div className="text-[11.5px] text-muted">{row.meta}</div>
              <div className="font-bold text-text">{Math.round(row.hours)} hrs</div>
            </div>
          );
        })}
      </div>

      {matching.length === 0 ? (
        <div className="text-center py-5 text-muted text-[13px]">No matches found.</div>
      ) : null}

      <Button
        variant="outline"
        disabled={disableViewFull}
        onClick={() => setExpanded((e) => !e)}
        className="w-full mt-[13px] !text-[12px] !px-2 !py-2"
      >
        {expanded ? `Show Top ${PREVIEW_SIZE}` : 'View Full Leaderboard'}
      </Button>
    </div>
  );
}
