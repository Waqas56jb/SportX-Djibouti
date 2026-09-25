import { reportService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { usePermission } from '@/hooks/usePermission';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { AttentionRow, KpiRow } from '@/components/dashboard/DashboardStats';
import { SalesAnalyticsChart } from '@/components/dashboard/SalesAnalyticsChart';
import { CategorySalesPanel } from '@/components/dashboard/CategorySalesPanel';
import { TopProductsPanel } from '@/components/dashboard/TopProductsPanel';
import { RecentOrdersPanel } from '@/components/dashboard/RecentOrdersPanel';
import { LowStockPanel } from '@/components/dashboard/LowStockPanel';
import { RangeFilter } from '@/components/reports/RangeFilter';
import { rangeLabel } from '@/components/reports/ReportHeader';
import { periodWord, useReportRange } from '@/components/reports/useReportRange';

export default function DashboardPage() {
  const rangeState = useReportRange('30d');
  const { range, key } = rangeState;
  const periodLabel = rangeLabel(rangeState);
  // One call: KPIs, attention counters, sales chart, categories, top products and recent orders.
  const { data, loading, error, reload } = useAsync(() => reportService.getDashboard(range), [key]);
  const retry = () => void reload();
  // The low-stock widget reads /inventory/low-stock, which needs inventory:view.
  const canSeeStock = usePermission('inventory:view');

  return (
    <div>
      <DashboardHeader />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-zinc-900">
          Performance <span className="font-normal text-zinc-500">· {periodLabel}</span>
        </h2>
        <RangeFilter state={rangeState} />
      </div>

      <KpiRow stats={data?.stats} loading={loading} error={error} onRetry={retry} period={periodWord(range.preset)} />
      <AttentionRow stats={data?.stats} loading={loading} error={error} />

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <SalesAnalyticsChart data={data} loading={loading} error={error} onRetry={retry} periodLabel={periodLabel} />
        <CategorySalesPanel data={data?.salesByCategory} loading={loading} error={error} onRetry={retry} periodLabel={periodLabel} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <TopProductsPanel data={data?.topProducts} loading={loading} error={error} onRetry={retry} periodLabel={periodLabel} className={canSeeStock ? undefined : 'xl:col-span-5'} />
        {canSeeStock && <LowStockPanel />}
      </div>

      <div className="mt-4">
        <RecentOrdersPanel data={data?.recentOrders} loading={loading} error={error} onRetry={retry} />
      </div>
    </div>
  );
}
