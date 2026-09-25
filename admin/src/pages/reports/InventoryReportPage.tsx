import { AlertTriangle, Boxes, Layers, PackageX, Shirt, Wallet } from 'lucide-react';
import { reportService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { KpiCard } from '@/components/charts';
import { ErrorState } from '@/components/common';
import { ReportHeader } from '@/components/reports/ReportHeader';
import { KpiGrid } from '@/components/reports/ChartKit';
import { StockAgingChart, StockMovementChart, StockStatusBreakdown, TopStockedPanel } from '@/components/reports/InventoryCharts';
import { STOCK_STATUS } from '@/constants/status';
import { exportCsv } from '@/utils/csv';
import { formatMoney, formatNumber } from '@/utils/format';

export default function InventoryReportPage() {
  const { data, loading, error, reload } = useAsync(() => reportService.getInventoryReport(), []);
  const t = data?.totals;
  const busy = loading || !data;
  const retry = () => void reload();

  const onExport = () =>
    data &&
    exportCsv('inventory-report', data.items, [
      { header: 'Product', value: (i) => i.productName },
      { header: 'Variant', value: (i) => i.variantLabel },
      { header: 'SKU', value: (i) => i.sku },
      { header: 'Stock', value: (i) => i.stock },
      { header: 'Reserved', value: (i) => i.reserved },
      { header: 'Available', value: (i) => i.available },
      { header: 'Low-stock threshold', value: (i) => i.threshold },
      { header: 'Status', value: (i) => STOCK_STATUS[i.status].label },
      { header: 'Unit cost', value: (i) => i.unitCost },
      { header: 'Stock value (cost)', value: (i) => i.stock * i.unitCost },
      { header: 'Days since restock', value: (i) => i.daysSinceRestock },
    ]);

  return (
    <div>
      <ReportHeader
        title="Inventory report"
        description="A live snapshot of stock on hand, its value and how quickly it moves."
        onExport={onExport}
        exportDisabled={!data?.items.length}
        periodLabel="Snapshot as of now · movement covers the last 8 weeks"
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
            <KpiCard label="Inventory Value (Cost)" icon={Wallet} loading={busy} value={t && formatMoney(t.inventoryValue, { compact: true })} period="Stock × unit cost" />
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
