import { AlertTriangle, Boxes, Layers, PackageX, Shirt, Wallet } from 'lucide-react';
import { reportService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { KpiCard } from '@/components/charts';
import { ErrorState } from '@/components/common';
import { ReportHeader, rangeLabel } from '@/components/reports/ReportHeader';
import { GroupBySelect } from '@/components/reports/RangeFilter';
import { useGroupBy, useReportRange } from '@/components/reports/useReportRange';
import { KpiGrid } from '@/components/reports/ChartKit';
import { StockAgingChart, StockMovementChart, StockStatusBreakdown, TopStockedPanel } from '@/components/reports/InventoryCharts';
import { formatMoney, formatNumber } from '@/utils/format';

export default function InventoryReportPage() {
  const rs = useReportRange('3m');
  const { groupBy, setGroupBy, bucket } = useGroupBy();
  const { data, loading, error, reload } = useAsync(() => reportService.getInventoryReport(rs.range, bucket), [rs.key, bucket]);
  const t = data?.totals;
  const busy = loading || !data;
  const retry = () => void reload();

  // Server-generated per-product stock valuation CSV.
  const onExport = () => reportService.exportReport('inventory');

  return (
    <div>
      <ReportHeader
        title="Inventory report"
        description="A live snapshot of stock on hand, its value and how quickly it moves."
        onExport={onExport}
        exportDisabled={!data?.totals.variants}
        rangeState={rs}
        filters={<GroupBySelect value={groupBy} onChange={setGroupBy} />}
        periodLabel={`Stock snapshot as of now · movement: ${rangeLabel(rs)}`}
      />

      {error ? (
        <div className="panel">
          <ErrorState onRetry={retry} description="We couldn’t load the inventory report. Please try again." />
        </div>
      ) : (
        <>
          <KpiGrid>
            <KpiCard label="Total Products" icon={Shirt} loading={busy} value={t && formatNumber(t.products)} period="Excludes archived products" />
            <KpiCard label="Total Variants" icon={Layers} loading={busy} value={t && formatNumber(t.variants)} period={t ? `${formatNumber(t.units)} units on hand` : undefined} />
            <KpiCard label="Low Stock" icon={AlertTriangle} loading={busy} value={t && formatNumber(t.lowStock)} period="Variants at or below threshold" to="/inventory?status=low_stock" />
            <KpiCard label="Out of Stock" icon={PackageX} loading={busy} value={t && formatNumber(t.outOfStock)} period="Variants with zero units" to="/inventory?status=out_of_stock" />
            <KpiCard label="Inventory Value (Cost)" icon={Wallet} loading={busy} value={t && formatMoney(t.inventoryValue, { compact: true })} period={t?.variantsMissingCost ? `Stock × cost price · ${t.variantsMissingCost} variant(s) have no cost price` : 'Stock × cost price'} />
            <KpiCard label="Retail Value" icon={Boxes} loading={busy} value={t && formatMoney(t.retailValue, { compact: true })} period={t && t.retailValue ? `${Math.round((1 - t.inventoryValue / t.retailValue) * 100)}% potential margin` : 'Stock × selling price'} />
          </KpiGrid>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <StockAgingChart data={data?.aging} loading={loading} error={error} onRetry={retry} />
            <StockMovementChart data={data?.movement} loading={loading} error={error} onRetry={retry} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <TopStockedPanel data={data?.topStocked} loading={loading} error={error} onRetry={retry} />
            </div>
            <StockStatusBreakdown data={data?.byStatus} loading={loading} />
          </div>
        </>
      )}
    </div>
  );
}
