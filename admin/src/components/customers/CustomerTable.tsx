import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Users } from 'lucide-react';
import type { Customer } from '@/types';
import { Avatar, EmptyState, Menu, StatusBadge } from '@/components/common';
import { DataTable, type Column, type DataTableProps } from '@/components/tables';
import { CUSTOMER_STATUS } from '@/constants/status';
import { usePermission } from '@/hooks/usePermission';
import { formatDate, formatMoney, formatNumber, formatRelative } from '@/utils/format';
import { CustomerFormDrawer } from './CustomerFormDrawer';
import { fullName, statusMenuItems, useCustomerStatus } from './useCustomerStatus';

export interface CustomerTableProps {
  data: Customer[] | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  /** Called with the fresh record after an edit or status change. */
  onUpdated: (c: Customer) => void;
  toolbar?: ReactNode;
  toolbarRight?: ReactNode;
  empty?: ReactNode;
  caption?: string;
  storageKey?: string;
  /** Server-side sort + pagination wiring (see useServerList). */
  table?: Pick<DataTableProps<Customer>, 'sort' | 'onSortChange' | 'serverPagination'>;
}

/** Customer list with row actions, edit drawer and status transitions. Shared by Customers and Groups. */
export function CustomerTable({ data, loading, error, onRetry, onUpdated, toolbar, toolbarRight, empty, caption = 'Customers', storageKey = 'customers', table }: CustomerTableProps) {
  const navigate = useNavigate();
  const canEdit = usePermission('customers:edit');
  const [editing, setEditing] = useState<Customer | null>(null);
  const { change } = useCustomerStatus();

  const columns = useMemo<Column<Customer>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        hideable: false,
        mobile: 'title',
        sortValue: (c) => fullName(c),
        cell: (c) => (
          <span className="flex min-w-0 items-center gap-3">
            <Avatar name={fullName(c)} src={c.avatarUrl} size={34} />
            <span className="min-w-0">
              <span className="block truncate font-medium text-zinc-900">{fullName(c)}</span>
              <span className="block truncate text-xs text-zinc-500">{c.email}</span>
            </span>
          </span>
        ),
      },
      { id: 'email', header: 'Email', mobile: 'hidden', defaultHidden: true, cell: (c) => <span className="text-zinc-600">{c.email}</span> },
      { id: 'phone', header: 'Phone', mobile: 'meta', cell: (c) => <span className="whitespace-nowrap tabular text-zinc-600">{c.phone}</span> },
      { id: 'orders', header: 'Orders', label: 'Orders', align: 'right', sortValue: (c) => c.ordersCount, cell: (c) => <span className="tabular font-medium text-zinc-900">{formatNumber(c.ordersCount)}</span> },
      { id: 'spent', header: 'Total spent', align: 'right', mobile: 'aside', sortValue: (c) => c.totalSpent, cell: (c) => <span className="whitespace-nowrap tabular font-medium text-zinc-900">{formatMoney(c.totalSpent)}</span> },
      {
        id: 'lastOrder',
        header: 'Last order',
        sortValue: (c) => c.lastOrderAt ?? '',
        cell: (c) => (c.lastOrderAt ? <span className="whitespace-nowrap text-zinc-600" title={formatDate(c.lastOrderAt)}>{formatRelative(c.lastOrderAt)}</span> : <span className="text-zinc-400">No orders</span>),
      },
      { id: 'status', header: 'Status', mobile: 'subtitle', cell: (c) => <StatusBadge map={CUSTOMER_STATUS} value={c.status} /> },
      { id: 'joined', header: 'Joined', sortValue: (c) => c.joinedAt, cell: (c) => <span className="whitespace-nowrap text-zinc-600">{formatDate(c.joinedAt)}</span> },
    ],
    [],
  );

  return (
    <>
      <DataTable
        caption={caption}
        storageKey={storageKey}
        data={data}
        columns={columns}
        getRowId={(c) => c.id}
        loading={loading}
        error={error}
        onRetry={onRetry}
        toolbar={toolbar}
        toolbarRight={toolbarRight}
        initialSort={{ id: 'joined', dir: 'desc' }}
        {...table}
        onRowClick={(c) => navigate(`/customers/${c.id}`)}
        rowClassName={(c) => (c.status === 'blocked' ? 'opacity-70' : undefined)}
        empty={empty ?? <EmptyState icon={Users} title="No customers found." description="Try a different search term or clear the filters." />}
        rowActions={(c) => (
          <Menu
            label={`Actions for ${fullName(c)}`}
            items={[
              { label: 'View profile', icon: Eye, onSelect: () => navigate(`/customers/${c.id}`) },
              { label: 'Edit', icon: Pencil, onSelect: () => setEditing(c), hidden: !canEdit },
              ...(canEdit
                ? statusMenuItems(c, async (s) => {
                    const updated = await change(c, s);
                    if (updated) onUpdated(updated);
                  })
                : []),
            ]}
          />
        )}
      />
      <CustomerFormDrawer customer={editing} onClose={() => setEditing(null)} onSaved={onUpdated} />
    </>
  );
}
