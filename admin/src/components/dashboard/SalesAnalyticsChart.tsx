import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardData, SalesPoint } from '@/types';
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

/** Sales over the selected period from the dashboard payload; the delta compares with the previous equal-length period. */
export function SalesAnalyticsChart({ data: dash, loading, error, onRetry, periodLabel }: { data: DashboardData | undefined; loading: boolean; error: Error | null; onRetry: () => void; periodLabel: string }) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const data = dash ? { current: dash.salesChart, previous: null as SalesPoint[] | null } : undefined;

  const fmt = (v: number) => (metric === 'orders' ? formatNumber(v) : formatMoney(Math.round(v)));
  const rows = useMemo<Row[]>(
    () => (data?.current ?? []).map((p, i) => ({ label: p.label, current: p[metric], previous: data?.previous?.[i]?.[metric], previousLabel: data?.previous?.[i]?.label })),
    [data, metric],
  );
  const cur = data ? total(data.current, metric) : 0;
  const change = !dash ? undefined : metric === 'revenue' ? dash.stats.revenue.change : metric === 'orders' ? dash.stats.orders.change : undefined;
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
      <ChartFrame height={280} loading={loading} error={error} onRetry={onRetry} empty={!loading && rows.length === 0}>
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
