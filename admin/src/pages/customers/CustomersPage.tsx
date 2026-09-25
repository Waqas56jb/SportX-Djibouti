import { useNavigate } from 'react-router-dom';
import { Download, Layers, Users } from 'lucide-react';
import type { Customer, CustomerGroup, CustomerStatus } from '@/types';
import { Button, Can, EmptyState, PageHeader } from '@/components/common';
import { FilterSelect, SearchInput } from '@/components/forms';
import { ClearFiltersButton } from '@/components/tables';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { CUSTOMER_CITIES } from '@/components/customers/useCustomerStatus';
import { CUSTOMER_STATUS } from '@/constants/status';
import { CUSTOMER_GROUPS, customerService } from '@/services/customerService';
import { useAsync } from '@/hooks/useAsync';
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

  const { data, loading, error, reload, setData } = useAsync(
    () =>
      customerService.getCustomers({
        search,
        status: filters.status as CustomerStatus | '',
        group: filters.group as CustomerGroup | '',
        city: filters.city,
      }),
    [search, filters.status, filters.group, filters.city],
  );

  const onUpdated = (c: Customer) => setData((list) => list?.map((x) => (x.id === c.id ? c : x)));

  const exportList = () => {
    if (!data?.length) return;
    exportCsv('customers', data, [
      { header: 'First name', value: (c) => c.firstName },
      { header: 'Last name', value: (c) => c.lastName },
      { header: 'Email', value: (c) => c.email },
      { header: 'Phone', value: (c) => c.phone },
      { header: 'City', value: (c) => c.addresses.find((a) => a.isDefault)?.city ?? c.addresses[0]?.city },
      { header: 'Status', value: (c) => CUSTOMER_STATUS[c.status].label },
      { header: 'Orders', value: (c) => c.ordersCount },
      { header: 'Total spent', value: (c) => c.totalSpent },
      { header: 'Average order', value: (c) => Math.round(c.averageOrder) },
      { header: 'Last order', value: (c) => (c.lastOrderAt ? formatDate(c.lastOrderAt) : '') },
      { header: 'Marketing opt-in', value: (c) => (c.marketingOptIn ? 'Yes' : 'No') },
      { header: 'Joined', value: (c) => formatDate(c.joinedAt) },
    ]);
    toast.success('Export ready.', { description: `${data.length} customers exported to CSV.` });
  };

  const hasFilters = activeCount > 0 || Boolean(filters.search);
  const clearAll = () => resetFilters();

  return (
    <div>
      <PageHeader
        title="Customers"
        description={data && !loading ? `${formatNumber(data.length)} ${data.length === 1 ? 'customer' : 'customers'}${hasFilters ? ' match your filters' : ' in your store'}.` : 'Profiles, order history and account status.'}
        actions={
          <>
            <Button icon={Layers} onClick={() => navigate('/customers/groups')}>
              Customer groups
            </Button>
            <Can permission="customers:export">
              <Button icon={Download} onClick={exportList} disabled={!data?.length}>
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

