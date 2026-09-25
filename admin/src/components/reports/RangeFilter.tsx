import type { DateRangePreset } from '@/types';
import { RANGE_PRESETS } from '@/services';
import { Segmented } from '@/components/common';
import { DateInput } from '@/components/forms/Inputs';
import { cn } from '@/utils/cn';
import { dateInputOffset, type GroupBy, type ReportRangeState } from './useReportRange';

/** Preset switcher (Today / 7D / 30D / 3M / 12M) with an optional custom from–to range. */
export function RangeFilter({ state, allowCustom = true, className }: { state: ReportRangeState; allowCustom?: boolean; className?: string }) {
  const options: { value: DateRangePreset; label: string }[] = RANGE_PRESETS.map((p) => ({ value: p.value, label: p.short }));
  if (allowCustom) options.push({ value: 'custom', label: 'Custom' });
  const today = dateInputOffset(0);
  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      <Segmented ariaLabel="Date range" options={options} value={state.preset} onChange={state.setPreset} />
      {allowCustom && state.preset === 'custom' && (
        <div className="flex flex-wrap items-end gap-2">
          <DateInput label="From" value={state.fromInput} max={state.toInput || today} onChange={(e) => state.setFrom(e.target.value)} className="w-[150px]" />
          <DateInput label="To" value={state.toInput} min={state.fromInput} max={today} onChange={(e) => state.setTo(e.target.value)} className="w-[150px]" error={state.invalid ? 'Must be after start' : undefined} />
        </div>
      )}
    </div>
  );
}

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: '', label: 'Auto' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/** Bucket size for time series (Auto = chosen by the API from the range length). */
export function GroupBySelect({ value, onChange }: { value: GroupBy; onChange: (v: GroupBy) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-zinc-500">Group by</span>
      <Segmented ariaLabel="Group by" options={GROUP_OPTIONS} value={value} onChange={onChange} />
    </div>
  );
}
