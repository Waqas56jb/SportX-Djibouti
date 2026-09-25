import { Link, useNavigate } from 'react-router-dom';
import { Repeat, ShoppingCart, UserPlus, Users, Wallet } from 'lucide-react';
import type { CustomerReport } from '@/services/reportService';
import { reportService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { usePermission } from '@/hooks/usePermission';
import { KpiCard } from '@/components/charts';
import { Avatar, EmptyState } from '@/components/common';
import { DataTable, type Column } from '@/components/tables';
import { ReportHeader, rangeLabel } from '@/components/reports/ReportHeader';
import { CustomerGrowthChart, DistributionPanel, TotalCustomersChart } from '@/components/reports/CustomerCharts';
import { ExportButton } from '@/components/reports/ChartKit';
import { useGroupBy, useReportRange } from '@/components/reports/useReportRange';
import { GroupBySelect } from '@/components/reports/RangeFilter';
import { exportCsv } from '@/utils/csv';
import { formatMoney, formatNumber, formatPercent } from '@/utils/format';

type TopCustomer = CustomerReport['topCustomers'][number];

const columns: Column<TopCustomer>[] = [
  {
    id: 'name',
    header: 'Customer',
    hideable: false,
    mobile: 'title',
    sortValue: (c) => c.name,
    cell: (c) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={c.name} size={28} />
        <Link to={`/customers/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-zinc-900 hover:underline">
          {c.name}
        </Link>
      </div>
    ),
  },
  { id: 'orders', header: 'Orders', align: 'right', sortValue: (c) => c.orders, cell: (c) => <span className="tabular">{formatNumber(c.orders)}</span> },
  { id: 'aov', header: 'Avg. order', align: 'right', sortValue: (c) => (c.orders ? c.spent / c.orders : 0), cell: (c) => <span className="whitespace-nowrap tabular">{formatMoney(c.orders ? Math.round(c.spent / c.orders) : 0)}</span> },
  { id: 'spent', header: 'Total spent', align: 'right', mobile: 'aside', sortValue: (c) => c.spent, cell: (c) => <span className="whitespace-nowrap font-semibold text-zinc-900 tabular">{formatMoney(c.spent)}</span> },
];

export default function CustomerReportPage() {
  const rs = useReportRange('30d');
  const navigate = useNavigate();
  const canExport = usePermission('reports:export');
  const { groupBy, setGroupBy, bucket } = useGroupBy();
  const { data, loading, error, reload } = useAsync(() => reportService.getCustomerReport(rs.range, bucket), [rs.key, bucket]);
  const label = rangeLabel(rs);
  const t = data?.totals;
  const busy = loading || !data;
  const retry = () => void reload();

  // Server-generated CSV of the growth series (same range and grouping as the charts).
  const onExport = () => reportService.exportReport('customers', rs.range, { groupBy: bucket });

  const onExportTop = () =>
    data &&
    exportCsv('top-customers', data.topCustomers, [
      { header: 'Customer ID', value: (r) => r.id },
      { header: 'Name', value: (r) => r.name },
      { header: 'Email', value: (r) => r.email ?? '' },
      { header: 'Orders', value: (r) => r.orders },
      { header: 'Total spent', value: (r) => r.spent },
    ]);

  return (
    <div>
      <ReportHeader title="Customer insights" description="Acquisition, loyalty and where your customers are." rangeState={rs} onExport={onExport} exportDisabled={!data} periodLabel={label} filters={<GroupBySelect value={groupBy} onChange={setGroupBy} />} />

      {!error && (
        <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard label="New Customers" icon={UserPlus} loading={busy} value={t && formatNumber(t.newCustomers)} period={label} />
          <KpiCard label="Returning Customers" icon={Users} loading={busy} value={t && formatNumber(t.returningCustomers)} period={label} />
          <KpiCard label="Repeat Rate" icon={Repeat} loading={busy} value={t && formatPercent(t.repeatRate)} period="Returning ÷ buyers in period" />
          <KpiCard label="Average Spend" icon={Wallet} loading={busy} value={t && formatMoney(t.averageSpend, { compact: true })} period="Net paid revenue per paying customer" />
          <KpiCard label="Orders per Customer" icon={ShoppingCart} loading={busy} value={t && t.ordersPerCustomer.toFixed(2)} period={label} />
        </section>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <CustomerGrowthChart data={data?.growth} loading={loading} error={error} onRetry={retry} />
        <TotalCustomersChart data={data?.growth} loading={loading} error={error} onRetry={retry} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DistributionPanel title="Customers by city" description="Based on default address" data={data?.byCity} loading={loading} error={error} onRetry={retry} />
        <DistributionPanel title="Customers by group" description="Customers can belong to several groups" data={data?.byGroup} loading={loading} error={error} onRetry={retry} />
      </div>

      <div className="mt-6">
        <DataTable
          caption="Top customers by total spend"
          data={data?.topCustomers}
          columns={columns}
          getRowId={(c) => c.id}
          loading={loading}
          error={error}
          onRetry={retry}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          initialSort={{ id: 'spent', dir: 'desc' }}
          hidePagination
          toolbarRight={canExport ? <ExportButton onClick={onExportTop} disabled={!data?.topCustomers.length} /> : undefined}
          toolbar={
            <div>
              <h2 className="panel-title">Top customers</h2>
              <p className="mt-0.5 text-xs text-zinc-500">Net paid revenue in the selected period</p>
            </div>
          }
          empty={<EmptyState compact icon={Users} title="No customers yet" description="Customers appear here after their first order." />}
        />
      </div>
    </div>
  );
}
