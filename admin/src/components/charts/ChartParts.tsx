import type { ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/utils/cn';
import { CHART } from './theme';

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
  dashed?: boolean;
}

/** Tooltip surface used by every chart — pass `render` to Recharts' <Tooltip content>. */
export function ChartTooltipBox({ title, rows }: { title?: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="min-w-[160px] rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs shadow-pop">
      {title && <div className="mb-1.5 font-semibold text-zinc-900">{title}</div>}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-zinc-500">
              {r.color && <span className={cn('h-0.5 w-3 rounded', r.dashed && 'border-t-2 border-dashed bg-transparent')} style={r.dashed ? { borderColor: r.color } : { background: r.color }} />}
              {r.label}
            </span>
            <span className="font-semibold tabular text-zinc-900">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartLegend({ items, className }: { items: { label: string; color: string; dashed?: boolean }[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500', className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-0 w-3.5 border-t-2" style={{ borderColor: i.color, borderStyle: i.dashed ? 'dashed' : 'solid' }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Tiny trend line for KPI tiles. Decorative — the tile states the number and change. */
export function Sparkline({ data, color = CHART.ink, height = 36 }: { data: number[]; color?: string; height?: number }) {
  const points = data.map((v, i) => ({ i, v }));
  const id = `spark-${color.replace('#', '')}`;
  if (points.length < 2) return <div style={{ height }} />;
  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.14} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#${id})`} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
