import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CustomerGrowthPoint } from '@/types';
import { CHART, axisProps, ChartLegend, ChartTooltipBox } from '@/components/charts';
import { Panel } from '@/components/common';
import { formatNumber, formatPercent } from '@/utils/format';
import { ChartFrame, HBarChart, compactTick, gridProps } from './ChartKit';

interface Common {
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

const NEW = CHART.series[0];
const RET = CHART.series[1];

export function CustomerGrowthChart({ data, loading, error, onRetry }: Common & { data: CustomerGrowthPoint[] | undefined }) {
  const rows = data ?? [];
  return (
    <Panel
      title="Customer growth"
      description="New vs returning customers per period"
      actions={
        <ChartLegend
          items={[
            { label: 'New', color: NEW },
            { label: 'Returning', color: RET },
          ]}
        />
      }
      className="xl:col-span-2"
    >
      <ChartFrame height={290} loading={loading} error={error} onRetry={onRetry} empty={!loading && rows.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} minTickGap={8} />
            <YAxis {...axisProps} width={44} tickFormatter={compactTick} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'rgba(24,24,27,0.04)' }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as CustomerGrowthPoint | undefined;
                if (!active || !p) return null;
                const sum = p.newCustomers + p.returningCustomers;
                return (
                  <ChartTooltipBox
                    title={p.label}
                    rows={[
                      { label: 'New', value: formatNumber(p.newCustomers), color: NEW },
                      { label: 'Returning', value: formatNumber(p.returningCustomers), color: RET },
                      { label: 'Returning share', value: sum ? formatPercent((p.returningCustomers / sum) * 100) : '—' },
                    ]}
                  />
                );
              }}
            />
            {/* Stack order: new at the base, returning on top. 1px white gap separates segments. */}
            <Bar dataKey="newCustomers" name="New" stackId="c" fill={NEW} maxBarSize={28} stroke="#fff" strokeWidth={1} animationDuration={400} />
            <Bar dataKey="returningCustomers" name="Returning" stackId="c" fill={RET} radius={[4, 4, 0, 0]} maxBarSize={28} stroke="#fff" strokeWidth={1} animationDuration={400} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </Panel>
  );
}

export function TotalCustomersChart({ data, loading, error, onRetry }: Common & { data: CustomerGrowthPoint[] | undefined }) {
  const rows = data ?? [];
  const last = rows[rows.length - 1]?.total;
  return (
    <Panel title="Total customers" description="Cumulative customer base at the end of each period">
      <div className="mb-3 font-display text-[1.75rem] font-bold leading-none text-zinc-950 tabular" aria-live="polite">
        {loading || last === undefined ? '—' : formatNumber(last)}
      </div>
      <ChartFrame height={240} loading={loading} error={error} onRetry={onRetry} empty={!loading && rows.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} minTickGap={16} />
            <YAxis {...axisProps} width={44} tickFormatter={compactTick} domain={['dataMin - 100', 'auto']} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as CustomerGrowthPoint | undefined;
                if (!active || !p) return null;
                return <ChartTooltipBox title={p.label} rows={[{ label: 'Total customers', value: formatNumber(p.total), color: CHART.ink }]} />;
              }}
            />
            <Line type="monotone" dataKey="total" stroke={CHART.ink} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} animationDuration={400} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </Panel>
  );
}

export function DistributionPanel({ title, description, data, loading, error, onRetry }: Common & { title: string; description: string; data: { name: string; value: number }[] | undefined }) {
  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + r.value, 0);
  const bars = rows.slice(0, 8).map((r) => ({ name: r.name, value: r.value, note: total ? formatPercent((r.value / total) * 100) : undefined }));
  return (
    <Panel title={title} description={description}>
      <ChartFrame height={bars.length ? Math.max(160, bars.length * 36 + 16) : 240} loading={loading} error={error} onRetry={onRetry} empty={!loading && bars.length === 0} emptyTitle="No customers yet">
        <HBarChart data={bars} format={(v) => formatNumber(v)} valueLabel="Customers" rowHeight={36} labelWidth={96} />
      </ChartFrame>
    </Panel>
  );
}
