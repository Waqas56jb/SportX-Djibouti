import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { InventoryReport } from '@/services/reportService';
import { CHART, axisProps, ChartLegend, ChartTooltipBox } from '@/components/charts';
import { Panel, Segmented, Skeleton } from '@/components/common';
import { formatMoney, formatNumber, formatPercent, getActiveCurrency } from '@/utils/format';
import { ChartFrame, HBarChart, SimpleBarChart, compactTick, gridProps } from './ChartKit';

interface Common {
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function StockAgingChart({ data, loading, error, onRetry }: Common & { data: InventoryReport['aging'] | undefined }) {
  const [mode, setMode] = useState<'units' | 'value'>('units');
  const rows = data ?? [];
  return (
    <Panel
      title="Stock aging"
      description={`Days since last restock · ${mode === 'units' ? 'units on hand' : `cost value (${getActiveCurrency()})`}`}
      actions={
        <Segmented
          ariaLabel="Aging measure"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'units', label: 'Units' },
            { value: 'value', label: 'Value' },
          ]}
        />
      }
    >
      <ChartFrame height={260} loading={loading} error={error} onRetry={onRetry} empty={!loading && rows.length === 0}>
        <SimpleBarChart data={rows} xKey="bucket" yKey={mode} name={mode === 'units' ? 'Units' : 'Cost value'} format={(v) => (mode === 'units' ? `${formatNumber(v)} units` : formatMoney(v))} />
      </ChartFrame>
    </Panel>
  );
}

const IN = CHART.series[0];
const OUT = CHART.series[1];

export function StockMovementChart({ data, loading, error, onRetry }: Common & { data: InventoryReport['movement'] | undefined }) {
  const rows = data ?? [];
  return (
    <Panel
      title="Stock movement"
      description="Units in vs out per period (restocks, sales, returns)"
      actions={
        <ChartLegend
          items={[
            { label: 'Inbound', color: IN },
            { label: 'Outbound', color: OUT },
          ]}
        />
      }
    >
      <ChartFrame height={260} loading={loading} error={error} onRetry={onRetry} empty={!loading && rows.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={compactTick} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'rgba(24,24,27,0.04)' }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as InventoryReport['movement'][number] | undefined;
                if (!active || !p) return null;
                const net = p.inbound - p.outbound;
                return (
                  <ChartTooltipBox
                    title={`Week of ${p.label}`}
                    rows={[
                      { label: 'Inbound', value: formatNumber(p.inbound), color: IN },
                      { label: 'Outbound', value: formatNumber(p.outbound), color: OUT },
                      { label: 'Net change', value: `${net > 0 ? '+' : net < 0 ? '−' : ''}${formatNumber(Math.abs(net))}` },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="inbound" name="Inbound" fill={IN} radius={[4, 4, 0, 0]} maxBarSize={20} animationDuration={400} />
            <Bar dataKey="outbound" name="Outbound" fill={OUT} radius={[4, 4, 0, 0]} maxBarSize={20} animationDuration={400} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </Panel>
  );
}

export function TopStockedPanel({ data, loading, error, onRetry }: Common & { data: InventoryReport['topStocked'] | undefined }) {
  const rows = (data ?? []).map((r) => ({ name: r.name.length > 24 ? `${r.name.slice(0, 23)}…` : r.name, value: r.units }));
  return (
    <Panel title="Top stocked products" description="Units on hand across all variants">
      <ChartFrame height={rows.length ? Math.max(160, rows.length * 34 + 16) : 260} loading={loading} error={error} onRetry={onRetry} empty={!loading && rows.length === 0} emptyTitle="No stock on hand">
        <HBarChart data={rows} format={(v) => `${formatNumber(v)} units`} valueLabel="On hand" rowHeight={34} labelWidth={170} />
      </ChartFrame>
    </Panel>
  );
}

const STATUS_COLOR: Record<string, string> = { 'In stock': CHART.status.good, 'Low stock': CHART.status.warning, 'Out of stock': CHART.status.critical };

/** Share of variants per stock status: a single stacked bar plus a labelled legend (never colour alone). */
export function StockStatusBreakdown({ data, loading }: { data: InventoryReport['byStatus'] | undefined; loading: boolean }) {
  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <Panel title="Inventory status" description="Share of variants by stock status">
      {loading || !data ? (
        <div aria-busy="true" aria-label="Loading">
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="mt-5 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-zinc-100" role="img" aria-label={rows.map((r) => `${r.name}: ${r.value}`).join(', ')}>
            {rows
              .filter((r) => r.value > 0)
              .map((r) => (
                <div key={r.name} style={{ width: `${(r.value / Math.max(1, total)) * 100}%`, background: STATUS_COLOR[r.name] ?? CHART.ink }} />
              ))}
          </div>
          <ul className="mt-5 space-y-3">
            {rows.map((r) => (
              <li key={r.name} className="flex items-center justify-between gap-3 text-[0.8125rem]">
                <span className="flex items-center gap-2 text-zinc-700">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLOR[r.name] ?? CHART.ink }} aria-hidden />
                  {r.name}
                </span>
                <span className="tabular">
                  <span className="font-semibold text-zinc-900">{formatNumber(r.value)}</span>
                  <span className="ml-2 inline-block w-12 text-right text-zinc-500">{total ? formatPercent((r.value / total) * 100) : '—'}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            <span className="font-semibold text-zinc-800 tabular">{formatNumber(total)}</span> variants tracked.
          </p>
        </>
      )}
    </Panel>
  );
}
