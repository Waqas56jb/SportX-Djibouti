import { useMemo } from 'react';
import type { DateRange, DateRangePreset } from '@/types';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { fromDateInput } from '@/utils/format';

const PRESETS: DateRangePreset[] = ['today', '7d', '30d', '3m', '12m', 'custom'];

/** Local "YYYY-MM-DD" for a date offset by `days` from today. */
export function dateInputOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Period word used in "vs previous …" captions. */
export function periodWord(preset: DateRangePreset): string {
  switch (preset) {
    case 'today':
      return 'Day';
    case '7d':
      return '7 days';
    case '30d':
      return '30 days';
    case '3m':
      return '3 months';
    case '12m':
      return '12 months';
    default:
      return 'Period';
  }
}

/**
 * Date range held in the URL (`?range=30d` or `?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`)
 * so report views are shareable and survive refresh.
 */
export function useReportRange(defaultPreset: DateRangePreset = '30d') {
  const { filters, setFilter } = useUrlFilters({ range: defaultPreset as string, from: '', to: '' });
  const preset: DateRangePreset = PRESETS.includes(filters.range as DateRangePreset) ? (filters.range as DateRangePreset) : defaultPreset;

  const fromInput = filters.from || dateInputOffset(-29);
  const toInput = filters.to || dateInputOffset(0);
  const invalid = preset === 'custom' && fromInput > toInput;

  const range = useMemo<DateRange>(
    () => (preset === 'custom' && !invalid ? { preset, from: fromDateInput(fromInput), to: fromDateInput(toInput) } : { preset: preset === 'custom' ? defaultPreset : preset }),
    [preset, fromInput, toInput, invalid, defaultPreset],
  );

  /** Stable string for effect dependencies. */
  const key = `${range.preset}|${range.from ?? ''}|${range.to ?? ''}`;

  // One param per call: react-router's functional search-param updates are not queued.
  const setPreset = (p: DateRangePreset) => setFilter('range', p);

  return { range, key, preset, fromInput, toInput, invalid, setPreset, setFrom: (v: string) => setFilter('from', v), setTo: (v: string) => setFilter('to', v) };
}

export type ReportRangeState = ReturnType<typeof useReportRange>;

export type GroupBy = '' | 'hour' | 'day' | 'week' | 'month';

/** Optional bucket override (`?groupBy=week`); '' lets the API pick one for the range. */
export function useGroupBy() {
  const { filters, setFilter } = useUrlFilters({ groupBy: '' });
  const value = (['hour', 'day', 'week', 'month'].includes(filters.groupBy) ? filters.groupBy : '') as GroupBy;
  return { groupBy: value, setGroupBy: (v: GroupBy) => setFilter('groupBy', v), bucket: (value || undefined) as Exclude<GroupBy, ''> | undefined };
}
