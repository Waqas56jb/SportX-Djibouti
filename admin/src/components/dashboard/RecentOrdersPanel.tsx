import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import type { Order } from '@/types';
import { orderService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { DataTable, type Column } from '@/components/tables';
import { EmptyState, StatusBadge } from '@/components/common';
import { ORDER_STATUS, PAYMENT_STATUS } from '@/constants/status';
import { formatMoney, formatRelative, formatDateTime } from '@/utils/format';

const columns: Column<Order>[] = [
  { id: 'number', header: 'Order', hideable: false, mobile: 'title', cell: (o) => <span className="font-semibold text-zinc-900 tabular">{o.number}</span> },
  { id: 'customer', header: 'Customer', hideable: false, mobile: 'subtitle', cell: (o) => <span className="block max-w-[180px] truncate text-zinc-800">{o.customerName}</span> },
  {
    id: 'date',
    header: 'Date',
    hideable: false,
    cell: (o) => (
      <time dateTime={o.createdAt} title={formatDateTime(o.createdAt)} className="whitespace-nowrap text-zinc-500">
        {formatRelative(o.createdAt)}
      </time>
    ),
  },
  { id: 'items', header: 'Items', label: 'Items', hideable: false, align: 'right', cell: (o) => <span className="tabular">{o.itemsCount}</span> },
  { id: 'total', header: 'Total', hideable: false, align: 'right', mobile: 'aside', cell: (o) => <span className="whitespace-nowrap font-semibold text-zinc-900 tabular">{formatMoney(o.total)}</span> },
  { id: 'payment', header: 'Payment', hideable: false, cell: (o) => <StatusBadge map={PAYMENT_STATUS} value={o.payment.status} /> },
  { id: 'status', header: 'Status', hideable: false, cell: (o) => <StatusBadge map={ORDER_STATUS} value={o.status} /> },
];

export function RecentOrdersPanel() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(async () => (await orderService.getOrders()).slice(0, 6), []);

  return (
    <DataTable
      caption="Latest orders"
      data={data}
      columns={columns}
      getRowId={(o) => o.id}
      loading={loading}
      error={error}
      onRetry={() => void reload()}
      onRowClick={(o) => navigate(`/orders/${o.id}`)}
      hidePagination
      pageSize={6}
      toolbar={
        <div>
          <h2 className="panel-title">Recent orders</h2>
          <p className="mt-0.5 text-[0.8125rem] text-zinc-500">Latest activity across all channels</p>
        </div>
      }
      toolbarRight={
        <Link to="/orders" className="text-xs font-semibold text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline">
          View all orders
        </Link>
      }
      empty={<EmptyState compact icon={ShoppingBag} title="No orders yet" description="New orders will show up here as soon as they are placed." />}
    />
  );
}
