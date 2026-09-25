import { Banknote, BadgePercent, Receipt, RotateCcw, ShoppingBag, Wallet } from 'lucide-react';
import type { SalesPoint } from '@/types';
import { reportService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { KpiCard } from '@/components/charts';
import { EmptyState } from '@/components/common';
import { DataTable, type Column } from '@/components/tables';
import { ReportHeader, rangeLabel } from '@/components/reports/ReportHeader';
import { KpiGrid } from '@/components/reports/ChartKit';
import { GroupBySelect } from '@/components/reports/RangeFilter';
import { OrdersBarChart, RevenueNetChart } from '@/components/reports/SalesCharts';
import { periodWord, useGroupBy, useReportRange } from '@/components/reports/useReportRange';
import { formatMoney, formatNumber } from '@/utils/format';

const money = (v: number) => <span className="whitespace-nowrap tabular">{formatMoney(v)}</span>;

const columns: Column<SalesPoint>[] = [
  { id: 'label', header: 'Period', mobile: 'title', hideable: false, sortValue: (r) => r.date, cell: (r) => <span className="font-medium text-zinc-900">{r.label}</span> },
  { id: 'orders', header: 'Orders', align: 'right', sortValue: (r) => r.orders, cell: (r) => <span className="tabular">{formatNumber(r.orders)}</span> },
  { id: 'revenue', header: 'Revenue', align: 'right', sortValue: (r) => r.revenue, cell: (r) => money(r.revenue) },
  { id: 'aov', header: 'AOV', label: 'Average order value', align: 'right', defaultHidden: true, sortValue: (r) => r.aov, cell: (r) => money(r.aov) },
  { id: 'discounts', header: 'Discounts', align: 'right', sortValue: (r) => r.discounts, cell: (r) => <span className="whitespace-nowrap text-zinc-500 tabular">−{formatMoney(r.discounts)}</span> },
  { id: 'refunds', header: 'Refunds', align: 'right', sortValue: (r) => r.refunds, cell: (r) => <span className="whitespace-nowrap text-zinc-500 tabular">−{formatMoney(r.refunds)}</span> },
  { id: 'net', header: 'Net sales', align: 'right', mobile: 'aside', sortValue: (r) => r.netSales, cell: (r) => <span className="whitespace-nowrap font-semibold text-zinc-900 tabular">{formatMoney(r.netSales)}</span> },
];

export default function SalesReportPage() {
  const rs = useReportRange('30d');
  const { groupBy, setGroupBy, bucket } = useGroupBy();
  const { data, loading, error, reload } = useAsync(() => reportService.getSalesReport(rs.range, bucket), [rs.key, bucket]);
  const label = rangeLabel(rs);
  const period = periodWord(rs.range.preset);
  const t = data?.totals;
  const c = data?.change;
  const busy = loading || !data;

  // Server-generated CSV (same range and grouping as the screen).
  const onExport = () => reportService.exportReport('sales', rs.range, { groupBy: bucket });

  return (
    <div>
      <ReportHeader title="Sales report" description="Revenue, orders and deductions over time, compared with the previous period." rangeState={rs} onExport={onExport} exportDisabled={!data?.series.length} periodLabel={label} filters={<GroupBySelect value={groupBy} onChange={setGroupBy} />} />

      {error ? null : (
        <KpiGrid>
          <KpiCard label="Revenue" icon={Banknote} loading={busy} value={t && formatMoney(t.revenue, { compact: true })} change={c?.revenue} period={period} />
          <KpiCard label="Orders" icon={ShoppingBag} loading={busy} value={t && formatNumber(t.orders)} change={c?.orders} period={period} />
          <KpiCard label="Average Order Value" icon={Receipt} loading={busy} value={t && formatMoney(t.aov, { compact: true })} change={c?.aov} period={period} />
          <KpiCard label="Discounts" icon={BadgePercent} loading={busy} value={t && formatMoney(t.discounts, { compact: true })} change={c?.discounts} inverse period={period} />
          <KpiCard label="Refunds" icon={RotateCcw} loading={busy} value={t && formatMoney(t.refunds, { compact: true })} change={c?.refunds} inverse period={period} />
          <KpiCard label="Net Sales" icon={Wallet} loading={busy} value={t && formatMoney(t.netSales, { compact: true })} change={c?.netSales} period={period} />
        </KpiGrid>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <RevenueNetChart data={data?.series} loading={loading} error={error} onRetry={() => void reload()} periodLabel={label} />
        <OrdersBarChart data={data?.series} loading={loading} error={error} onRetry={() => void reload()} periodLabel={label} />
      </div>

      <div className="mt-6">
        <DataTable
          caption={`Sales by period, ${label}`}
          data={data?.series}
          columns={columns}
          getRowId={(r) => r.date}
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          initialSort={{ id: 'label', dir: 'desc' }}
          pageSize={10}
          storageKey="report-sales"
          toolbar={<h2 className="panel-title">Breakdown by period</h2>}
          empty={<EmptyState compact title="No sales in this period" description="Choose a wider date range to see results." />}
        />
      </div>
    </div>
  );
}
