import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Download } from 'lucide-react';
import { CHART, axisProps, ChartTooltipBox } from '@/components/charts';
import { Button, EmptyState, ErrorState } from '@/components/common';
import { formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

/** Compact axis tick, e.g. 1.2M / 450K / 980. */
export const compactTick = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return formatNumber(v);
};

/** Shared cartesian grid props — horizontal hairlines only. */
export const gridProps = { vertical: false, stroke: CHART.grid } as const;

/** Loading, error and empty handling around a fixed-height chart. */
export function ChartFrame({
  height = 280,
  loading,
  error,
  onRetry,
  empty,
  emptyTitle = 'No data for this period',
  emptyDescription = 'Try a wider date range.',
  children,
  className,
}: {
  height?: number;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: ReactNode;
  className?: string;
}) {
  if (error)
    return (
      <div style={{ minHeight: height }} className={cn('flex items-center justify-center', className)}>
        <ErrorState compact onRetry={onRetry} description="We couldn’t load this chart. Please try again." />
      </div>
    );
  if (loading)
    return (
      <div style={{ height }} className={cn('flex items-end gap-2 pb-6 pl-10', className)} aria-busy="true" aria-label="Loading chart">
        {[46, 62, 38, 70, 55, 80, 64, 50, 74, 58, 68, 44].map((h, i) => (
          <div key={i} className="skeleton flex-1 rounded-b-none" style={{ height: `${h}%` }} aria-hidden />
        ))}
      </div>
    );
  if (empty)
    return (
      <div style={{ minHeight: height }} className={cn('flex items-center justify-center', className)}>
        <EmptyState compact icon={BarChart3} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  return (
    <div style={{ height }} className={className}>
      {children}
    </div>
  );
}

export function ExportButton({ onClick, disabled, label = 'EXPORT CSV' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <Button variant="secondary" size="sm" icon={Download} onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  );
}

export interface HBarDatum {
  name: string;
  value: number;
  /** Optional right-hand annotation, e.g. "31.2%". */
  note?: string;
}

/**
 * Horizontal magnitude bars in a single hue. Labels sit on the category axis, values at the bar end.
 */
export function HBarChart({
  data,
  format,
  valueLabel,
  color = CHART.ink,
  rowHeight = 40,
  labelWidth = 104,
}: {
  data: HBarDatum[];
  format: (v: number) => string;
  valueLabel: string;
  color?: string;
  rowHeight?: number;
  labelWidth?: number;
}) {
  const height = Math.max(160, data.length * rowHeight + 16);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: data.some((d) => d.note) ? 128 : 88, bottom: 4, left: 0 }} barCategoryGap={10}>
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis type="category" dataKey="name" width={labelWidth} {...axisProps} tick={{ fontSize: 12, fill: '#3F434A' }} />
          <Tooltip
            cursor={{ fill: 'rgba(24,24,27,0.04)' }}
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload as HBarDatum | undefined;
              if (!active || !d) return null;
              return <ChartTooltipBox title={d.name} rows={[{ label: valueLabel, value: format(d.value), color }, ...(d.note ? [{ label: 'Share', value: d.note }] : [])]} />;
            }}
          />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive animationDuration={400}>
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              content={({ x, y, width, height: h, index }) => {
                const d = typeof index === 'number' ? data[index] : undefined;
                if (!d) return null;
                const cx = Number(x) + Number(width) + 8;
                const cy = Number(y) + Number(h) / 2;
                return (
                  <text x={cx} y={cy} dominantBaseline="central" fontSize={12} fill="#18181B" fontWeight={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {format(d.value)}
                    {d.note && (
                      <tspan fill={CHART.axis} fontWeight={500} dx={6}>
                        {d.note}
                      </tspan>
                    )}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Vertical bar chart helper for a single series. */
export function SimpleBarChart<T extends object>({
  data,
  xKey,
  yKey,
  name,
  format,
  color = CHART.ink,
  tickFormat = compactTick,
}: {
  data: T[];
  xKey: keyof T & string;
  yKey: keyof T & string;
  name: string;
  format: (v: number) => string;
  color?: string;
  tickFormat?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={xKey} {...axisProps} minTickGap={12} />
        <YAxis {...axisProps} width={48} tickFormatter={tickFormat} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: 'rgba(24,24,27,0.04)' }}
          content={({ active, payload, label }) => {
            const v = payload?.[0]?.value;
            if (!active || typeof v !== 'number') return null;
            return <ChartTooltipBox title={String(label)} rows={[{ label: name, value: format(v), color }]} />;
          }}
        />
        <Bar dataKey={yKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={400} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Percent change of `value` against `previous` (undefined when there is no baseline). */
export const pctChange = (value: number, previous: number) => (previous ? ((value - previous) / previous) * 100 : undefined);

/** KPI grid skeleton / container: 1 → 2 → 3 columns. */
export function KpiGrid({ children, cols = 3 }: { children: ReactNode; cols?: 3 | 4 }) {
  return <section aria-label="Key metrics" className={cn('grid gap-4 sm:grid-cols-2', cols === 3 ? 'lg:grid-cols-3' : 'xl:grid-cols-4')}>{children}</section>;
}
