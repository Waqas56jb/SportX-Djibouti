import { reportService, RANGE_PRESETS } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { AttentionRow, KpiRow } from '@/components/dashboard/DashboardStats';
import { SalesAnalyticsChart } from '@/components/dashboard/SalesAnalyticsChart';
import { CategorySalesPanel } from '@/components/dashboard/CategorySalesPanel';
import { TopProductsPanel } from '@/components/dashboard/TopProductsPanel';
import { RecentOrdersPanel } from '@/components/dashboard/RecentOrdersPanel';
import { LowStockPanel } from '@/components/dashboard/LowStockPanel';
import { RangeFilter } from '@/components/reports/RangeFilter';
import { periodWord, useReportRange } from '@/components/reports/useReportRange';

export default function DashboardPage() {
  const rangeState = useReportRange('30d');
  const { range, key } = rangeState;
  const periodLabel = RANGE_PRESETS.find((p) => p.value === range.preset)?.label ?? 'Selected period';
  const stats = useAsync(() => reportService.getDashboardStats(range), [key]);

  return (
    <div>
      <DashboardHeader />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-zinc-900">
          Performance <span className="font-normal text-zinc-500">· {periodLabel}</span>
        </h2>
        <RangeFilter state={rangeState} allowCustom={false} />
      </div>

      <KpiRow stats={stats.data} loading={stats.loading} error={stats.error} onRetry={() => void stats.reload()} period={periodWord(range.preset)} />
      <AttentionRow stats={stats.data} loading={stats.loading} error={stats.error} />

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <SalesAnalyticsChart range={range} rangeKey={key} periodLabel={periodLabel} />
        <CategorySalesPanel range={range} rangeKey={key} periodLabel={periodLabel} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <TopProductsPanel range={range} rangeKey={key} periodLabel={periodLabel} />
        <LowStockPanel />
      </div>

      <div className="mt-4">
        <RecentOrdersPanel />
      </div>
    </div>
  );
}
