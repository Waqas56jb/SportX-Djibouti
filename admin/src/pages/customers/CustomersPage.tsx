import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Layers, Users } from 'lucide-react';
import type { Customer, CustomerGroup, CustomerStatus } from '@/types';
import { Button, Can, EmptyState, PageHeader } from '@/components/common';
import { FilterSelect, SearchInput } from '@/components/forms';
import { ClearFiltersButton } from '@/components/tables';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { CUSTOMER_CITIES } from '@/components/customers/useCustomerStatus';
import { useServerList } from '@/components/customers/useServerList';
import { CUSTOMER_STATUS } from '@/constants/status';
import { CUSTOMER_GROUPS, customerService, type CustomerFilters } from '@/services/customerService';
import { useDebounce } from '@/hooks/misc';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { toast } from '@/store/toastStore';
import { exportCsv } from '@/utils/csv';
import { formatDate, formatNumber } from '@/utils/format';

const STATUS_OPTIONS = (Object.keys(CUSTOMER_STATUS) as CustomerStatus[]).map((s) => ({ value: s, label: CUSTOMER_STATUS[s].label }));
const GROUP_OPTIONS = CUSTOMER_GROUPS.filter((g) => g.id !== 'all').map((g) => ({ value: g.id, label: g.label }));
const CITY_OPTIONS = CUSTOMER_CITIES.map((c) => ({ value: c, label: c }));

export default function CustomersPage() {
  const { filters, setFilter, resetFilters, activeCount } = useUrlFilters({ search: '', status: '', group: '', city: '' });
  const search = useDebounce(filters.search, 250);
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  const listFilters: CustomerFilters = { status: filters.status as CustomerStatus | '', group: filters.group as CustomerGroup | '', city: filters.city };
  const list = useServerList((q) => customerService.getCustomers({ ...q, search, filters: listFilters }), [search, filters.status, filters.group, filters.city], {
    initialSort: { id: 'joined', dir: 'desc' },
  });
  const { loading, error, reload, setData } = list;
  const data = list.data?.data;
  const total = list.data?.total ?? 0;

  const onUpdated = (c: Customer) => setData((p) => (p ? { ...p, data: p.data.map((x) => (x.id === c.id ? c : x)) } : p));

  /** Exports every customer matching the current filters (all pages, in the table's sort order). */
  const exportList = async () => {
    if (!total) return;
    setExporting(true);
    let rows: Customer[] = [];
    try {
      const sort = list.table.sort;
      for (let page = 1; page <= 50; page++) {
        const res = await customerService.getCustomers({ page, pageSize: 100, search, filters: listFilters, sortBy: sort?.id, sortDir: sort?.dir });
        rows = rows.concat(res.data);
        if (rows.length >= res.total || !res.data.length) break;
      }
    } catch (e) {
      toast.error('Export failed', { description: e instanceof Error ? e.message : undefined });
      return;
    } finally {
      setExporting(false);
    }
    exportCsv('customers', rows, [
      { header: 'First name', value: (c) => c.firstName },
      { header: 'Last name', value: (c) => c.lastName },
      { header: 'Email', value: (c) => c.email },
      { header: 'Phone', value: (c) => c.phone },
      { header: 'City', value: (c) => c.city ?? '' },
      { header: 'Status', value: (c) => CUSTOMER_STATUS[c.status].label },
      { header: 'Orders', value: (c) => c.ordersCount },
      { header: 'Total spent', value: (c) => c.totalSpent },
      { header: 'Average order', value: (c) => Math.round(c.averageOrder) },
      { header: 'Last order', value: (c) => (c.lastOrderAt ? formatDate(c.lastOrderAt) : '') },
      { header: 'Joined', value: (c) => formatDate(c.joinedAt) },
    ]);
    toast.success('Export ready.', { description: `${rows.length} customers exported to CSV.` });
  };

  const hasFilters = activeCount > 0 || Boolean(filters.search);
  const clearAll = () => resetFilters();

  return (
    <div>
      <PageHeader
        title="Customers"
        description={list.data && !loading ? `${formatNumber(total)} ${total === 1 ? 'customer' : 'customers'}${hasFilters ? ' match your filters' : ' in your store'}.` : 'Profiles, order history and account status.'}
        actions={
          <>
            <Button icon={Layers} onClick={() => navigate('/customers/groups')}>
              Customer groups
            </Button>
            <Can permission="customers:export">
              <Button icon={Download} onClick={() => void exportList()} loading={exporting} disabled={!total}>
                Export CSV
              </Button>
            </Can>
          </>
        }
      />

      <CustomerTable
        caption="Customers"
        data={data}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        onUpdated={onUpdated}
        table={list.table}
        toolbar={
          <>
            <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search name, email or phone…" label="Search customers" className="w-full sm:w-72" />
            <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} options={STATUS_OPTIONS} />
            <FilterSelect label="Group" value={filters.group} onChange={(v) => setFilter('group', v)} options={GROUP_OPTIONS} />
            <FilterSelect label="City" value={filters.city} onChange={(v) => setFilter('city', v)} options={CITY_OPTIONS} />
            <ClearFiltersButton count={activeCount} onClear={clearAll} />
          </>
        }
        empty={
          <EmptyState
            icon={Users}
            title="No customers found."
            description={hasFilters ? 'No customer matches the current search or filters.' : 'Customers appear here once they create an account on the storefront.'}
            action={
              hasFilters ? (
                <Button size="sm" onClick={clearAll}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
