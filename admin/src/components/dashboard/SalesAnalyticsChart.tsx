import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DateRange, SalesPoint } from '@/types';
import { reportService, resolveRange } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { CHART, axisProps, ChartLegend, ChartTooltipBox, type TooltipRow } from '@/components/charts';
import { Delta, Panel, Segmented, Skeleton } from '@/components/common';
import { ChartFrame, compactTick, gridProps } from '@/components/reports/ChartKit';
import { formatMoney, formatNumber, getActiveCurrency } from '@/utils/format';

type Metric = 'revenue' | 'orders' | 'aov';

const METRICS: { value: Metric; label: string }[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'orders', label: 'Orders' },
  { value: 'aov', label: 'Avg. Order Value' },
];

const DAY = 86_400_000;

/** The equal-length window immediately before `range` (same month span a year earlier for 12M). */
export function previousRange(range: DateRange): DateRange | null {
  if (range.preset === 'today') return null;
  const b = resolveRange(range);
  if (b.bucket === 'month') {
    const from = new Date(b.from.getFullYear() - 1, b.from.getMonth(), 1);
    const to = new Date(b.to.getFullYear() - 1, b.to.getMonth(), b.to.getDate());
    return { preset: 'custom', from: from.toISOString(), to: to.toISOString() };
  }
  const from = new Date(b.from.getTime() - b.days * DAY);
  const to = new Date(b.from.getTime() - DAY);
  return { preset: 'custom', from: from.toISOString(), to: to.toISOString() };
}

function total(points: SalesPoint[], metric: Metric) {
  const revenue = points.reduce((s, p) => s + p.revenue, 0);
  const orders = points.reduce((s, p) => s + p.orders, 0);
  if (metric === 'revenue') return revenue;
  if (metric === 'orders') return orders;
  return orders ? revenue / orders : 0;
}

interface Row {
  label: string;
  current: number;
  previous?: number;
  previousLabel?: string;
}

export function SalesAnalyticsChart({ range, rangeKey, periodLabel }: { range: DateRange; rangeKey: string; periodLabel: string }) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const { data, loading, error, reload } = useAsync(async () => {
    const prev = previousRange(range);
    const [current, previous] = await Promise.all([reportService.getSalesSeries(range), prev ? reportService.getSalesSeries(prev) : Promise.resolve(null)]);
    return { current, previous };
  }, [rangeKey]);

  const fmt = (v: number) => (metric === 'orders' ? formatNumber(v) : formatMoney(Math.round(v)));
  const rows = useMemo<Row[]>(
    () => (data?.current ?? []).map((p, i) => ({ label: p.label, current: p[metric], previous: data?.previous?.[i]?.[metric], previousLabel: data?.previous?.[i]?.label })),
    [data, metric],
  );
  const cur = data ? total(data.current, metric) : 0;
  const prev = data?.previous ? total(data.previous, metric) : undefined;
  const change = prev ? ((cur - prev) / prev) * 100 : undefined;
  const hasPrev = Boolean(data?.previous?.length);

  return (
    <Panel
      title="Sales analytics"
      description={`${periodLabel}${metric === 'orders' ? '' : ` · ${getActiveCurrency()}`}`}
      actions={<Segmented ariaLabel="Chart metric" options={METRICS} value={metric} onChange={setMetric} />}
      className="xl:col-span-2"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div aria-live="polite">
          <div className="text-xs font-medium text-zinc-500">{metric === 'aov' ? 'Average order value' : `Total ${metric}`}</div>
          {loading ? (
            <Skeleton className="mt-1.5 h-7 w-36" />
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <span className="font-display text-[1.75rem] font-bold leading-none tracking-tight text-zinc-950 tabular">{data ? fmt(cur) : '—'}</span>
              {change !== undefined && <Delta value={change} />}
            </div>
          )}
        </div>
        <ChartLegend items={[{ label: 'This period', color: CHART.ink }, ...(hasPrev ? [{ label: 'Previous period', color: CHART.compare, dashed: true }] : [])]} />
      </div>
      <ChartFrame height={280} loading={loading} error={error} onRetry={() => void reload()} empty={!loading && rows.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.ink} stopOpacity={0.12} />
                <stop offset="100%" stopColor={CHART.ink} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} minTickGap={16} />
            <YAxis {...axisProps} width={48} tickFormatter={compactTick} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                const r = payload?.[0]?.payload as Row | undefined;
                if (!active || !r) return null;
                const rowsOut: TooltipRow[] = [{ label: 'This period', value: fmt(r.current), color: CHART.ink }];
                if (r.previous !== undefined) rowsOut.push({ label: `Previous${r.previousLabel ? ` (${r.previousLabel})` : ''}`, value: fmt(r.previous), color: CHART.compare, dashed: true });
                return <ChartTooltipBox title={r.label} rows={rowsOut} />;
              }}
            />
            {hasPrev && <Line type="monotone" dataKey="previous" stroke={CHART.compare} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 3 }} animationDuration={400} />}
            <Area type="monotone" dataKey="current" stroke={CHART.ink} strokeWidth={2} fill="url(#sales-fill)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} animationDuration={400} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
    </Panel>
  );
}
