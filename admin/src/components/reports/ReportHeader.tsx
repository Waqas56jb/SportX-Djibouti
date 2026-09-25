import type { ReactNode } from 'react';
import { RANGE_PRESETS } from '@/services';
import { DemoBadge, PageHeader } from '@/components/common';
import { usePermission } from '@/hooks/usePermission';
import { RangeFilter } from './RangeFilter';
import { ExportButton } from './ChartKit';
import type { ReportRangeState } from './useReportRange';

/** Page header + filter bar shared by every report. Export is shown to admins with `reports:export`. */
export function ReportHeader({
  title,
  description,
  rangeState,
  onExport,
  exportDisabled,
  filters,
  periodLabel,
}: {
  title: string;
  description: ReactNode;
  rangeState?: ReportRangeState;
  onExport: () => void;
  exportDisabled?: boolean;
  filters?: ReactNode;
  periodLabel?: string;
}) {
  const canExport = usePermission('reports:export');
  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title={title}
        description={description}
        meta={
          <>
            <DemoBadge />
            {periodLabel && <span className="text-xs font-medium text-zinc-500">{periodLabel}</span>}
          </>
        }
        actions={canExport ? <ExportButton onClick={onExport} disabled={exportDisabled} /> : undefined}
      />
      {(rangeState || filters) && (
        <div className="mb-6 flex flex-col gap-3 border-b border-zinc-200/80 pb-4 lg:flex-row lg:items-end lg:justify-between">
          {rangeState && <RangeFilter state={rangeState} />}
          {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
        </div>
      )}
    </>
  );
}

/** Human label for the active range, e.g. "Last 30 days" or "01 Sep 2026 – 25 Sep 2026". */
export function rangeLabel(state: ReportRangeState): string {
  if (state.range.preset === 'custom' && state.range.from && state.range.to) {
    const f = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${f.format(new Date(state.range.from))} – ${f.format(new Date(state.range.to))}`;
  }
  return RANGE_PRESETS.find((p) => p.value === state.range.preset)?.label ?? 'Selected period';
}
