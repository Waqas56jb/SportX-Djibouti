import { AlertTriangle, Banknote, Clock3, LifeBuoy, Package, RotateCcw, ShoppingBag, UserPlus } from 'lucide-react';
import type { DashboardStats } from '@/types';
import { AttentionStat, KpiCard } from '@/components/charts';
import { ErrorState } from '@/components/common';
import { formatMoney, formatNumber } from '@/utils/format';

interface Props {
  stats: DashboardStats | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  /** Word used in "vs previous …", e.g. "7 days". */
  period: string;
}

export function KpiRow({ stats, loading, error, onRetry, period }: Props) {
  if (error)
    return (
      <div className="panel">
        <ErrorState compact onRetry={onRetry} description="We couldn’t load headline metrics. Please try again." />
      </div>
    );
  const busy = loading || !stats;
  return (
    <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Total Revenue" icon={Banknote} loading={busy} value={stats && formatMoney(stats.revenue.value, { compact: true })} change={stats?.revenue.change} period={period} trend={stats?.revenue.trend} to="/reports/sales" />
      <KpiCard label="Orders" icon={ShoppingBag} loading={busy} value={stats && formatNumber(stats.orders.value)} change={stats?.orders.change} period={period} trend={stats?.orders.trend} to="/orders" />
      <KpiCard label="New Customers" icon={UserPlus} loading={busy} value={stats && formatNumber(stats.customers.value)} change={stats?.customers.change} period={period} trend={stats?.customers.trend} to="/reports/customers" />
      <KpiCard label="Products Sold" icon={Package} loading={busy} value={stats && formatNumber(stats.productsSold.value)} change={stats?.productsSold.change} period={period} trend={stats?.productsSold.trend} to="/reports/products" />
    </section>
  );
}

/** Operational counters are live (not range-bound): what needs action right now. */
export function AttentionRow({ stats, loading, error }: Omit<Props, 'period' | 'onRetry'>) {
  if (error) return null;
  const busy = loading || !stats;
  const n = (v: number | undefined) => v ?? 0;
  return (
    <section aria-labelledby="attention-heading" className="mt-6">
      <h2 id="attention-heading" className="eyebrow mb-2.5">
        Needs attention
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AttentionStat label="Pending Orders" hint="Awaiting fulfilment" icon={Clock3} tone={n(stats?.pendingOrders) > 0 ? 'warning' : 'neutral'} value={n(stats?.pendingOrders)} loading={busy} to="/orders?status=pending" />
        <AttentionStat label="Low Stock" hint={stats?.outOfStock ? `At or below threshold · ${stats.outOfStock} out of stock` : 'Variants at or below threshold'} icon={AlertTriangle} tone={n(stats?.lowStock) > 0 ? 'warning' : 'neutral'} value={n(stats?.lowStock)} loading={busy} to="/inventory?status=low_stock" />
        <AttentionStat label="Refund Requests" hint="Awaiting a decision" icon={RotateCcw} tone={n(stats?.refundRequests) > 0 ? 'danger' : 'neutral'} value={n(stats?.refundRequests)} loading={busy} to="/orders?status=refund_requested" />
        <AttentionStat label="Open Support Tickets" hint="Customers waiting on a reply" icon={LifeBuoy} tone={n(stats?.openTickets) > 0 ? 'info' : 'neutral'} value={n(stats?.openTickets)} loading={busy} to="/support?status=open" />
      </div>
    </section>
  );
}
