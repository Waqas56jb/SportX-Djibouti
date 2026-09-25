import { Link } from 'react-router-dom';
import type { DateRange } from '@/types';
import { reportService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { Panel } from '@/components/common';
import { ChartFrame, HBarChart } from '@/components/reports/ChartKit';
import { formatMoney, formatNumber } from '@/utils/format';

export function CategorySalesPanel({ range, rangeKey, periodLabel }: { range: DateRange; rangeKey: string; periodLabel: string }) {
  const { data, loading, error, reload } = useAsync(() => reportService.getCategorySales(range), [rangeKey]);
  const rows = (data ?? []).map((c) => ({ name: c.category, value: c.revenue, note: `${c.share.toFixed(1)}%` }));
  const units = (data ?? []).reduce((s, c) => s + c.units, 0);

  return (
    <Panel
      title="Sales by category"
      description={`Revenue and share · ${periodLabel}`}
      actions={
        <Link to="/reports/products" className="text-xs font-semibold text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline">
          Details
        </Link>
      }
    >
      <ChartFrame height={rows.length ? rows.length * 42 + 16 : 268} loading={loading} error={error} onRetry={() => void reload()} empty={!loading && rows.length === 0}>
        <HBarChart data={rows} format={(v) => formatMoney(v, { compact: true })} valueLabel="Revenue" rowHeight={42} labelWidth={88} />
      </ChartFrame>
      {!loading && !error && units > 0 && (
        <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          <span className="font-semibold text-zinc-800 tabular">{formatNumber(units)}</span> units sold across {rows.length} categories.
        </p>
      )}
    </Panel>
  );
}
