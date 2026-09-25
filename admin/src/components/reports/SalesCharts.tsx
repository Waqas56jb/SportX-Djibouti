import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SalesPoint } from '@/types';
import { CHART, axisProps, ChartLegend, ChartTooltipBox } from '@/components/charts';
import { Panel } from '@/components/common';
import { formatMoney, formatNumber, getActiveCurrency } from '@/utils/format';
import { ChartFrame, SimpleBarChart, compactTick, gridProps } from './ChartKit';

interface ChartProps {
  data: SalesPoint[] | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  periodLabel: string;
}

const REV = CHART.series[0];
const NET = CHART.series[1];

export function RevenueNetChart({ data, loading, error, onRetry, periodLabel }: ChartProps) {
  const rows = data ?? [];
  return (
    <Panel
      title="Revenue vs net sales"
      description={`${periodLabel} · ${getActiveCurrency()} · net = revenue − discounts − refunds`}
      actions={
        <ChartLegend
          items={[
            { label: 'Revenue', color: REV },
            { label: 'Net sales', color: NET },
          ]}
        />
      }
      className="xl:col-span-2"
    >
      <ChartFrame height={290} loading={loading} error={error} onRetry={onRetry} empty={!loading && rows.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} minTickGap={16} />
            <YAxis {...axisProps} width={48} tickFormatter={compactTick} />
            <Tooltip
              cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as SalesPoint | undefined;
                if (!active || !p) return null;
                return (
                  <ChartTooltipBox
                    title={p.label}
                    rows={[
                      { label: 'Revenue', value: formatMoney(p.revenue), color: REV },
                      { label: 'Net sales', value: formatMoney(p.netSales), color: NET },
                      { label: 'Discounts', value: formatMoney(p.discounts) },
                      { label: 'Refunds', value: formatMoney(p.refunds) },
                    ]}
                  />
                );
              }}
            />
            <Line type="monotone" dataKey="revenue" name="Revenue" stroke={REV} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} animationDuration={400} />
            <Line type="monotone" dataKey="netSales" name="Net sales" stroke={NET} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} animationDuration={400} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </Panel>
  );
}

export function OrdersBarChart({ data, loading, error, onRetry, periodLabel }: ChartProps) {
  const rows = data ?? [];
  return (
    <Panel title="Orders" description={`Orders placed · ${periodLabel}`}>
      <ChartFrame height={290} loading={loading} error={error} onRetry={onRetry} empty={!loading && rows.length === 0}>
        <SimpleBarChart data={rows} xKey="label" yKey="orders" name="Orders" format={(v) => formatNumber(v)} />
      </ChartFrame>
    </Panel>
  );
}
