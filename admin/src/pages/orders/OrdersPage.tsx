import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, PackageCheck, RefreshCw, SearchX, ShoppingBag, Timer } from 'lucide-react';
import type { Order, OrderFilters as ServiceFilters, OrderStatus, PaymentStatus, ShippingStatus } from '@/types';
import { orderService } from '@/services/orderService';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePermission } from '@/hooks/usePermission';
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, SHIPPING_STATUS } from '@/constants/status';
import { exportCsv } from '@/utils/csv';
import { formatDate, formatMoney, formatTime } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { Button, EmptyState, PageHeader, StatusBadge, Tabs } from '@/components/common';
import { BulkButton, DataTable, type Column } from '@/components/tables';
import { OrderFilters, type OrderFilterValues } from '@/components/orders/OrderFilters';
import { OrderRowMenu } from '@/components/orders/OrderRowMenu';
import { ORDER_CSV, canTransition, resolveRange } from '@/components/orders/orderMeta';
import { refreshBadges, useOrderActions } from '@/components/orders/useOrderActions';

type TabValue = OrderStatus | 'all';
const TABS: { value: TabValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];
const DEFAULTS: OrderFilterValues = { status: '', search: '', date: '', from: '', to: '', payment: '', shipping: '', min: '', max: '' };

export default function OrdersPage() {
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const { filters, setFilter } = useUrlFilters(DEFAULTS);
  const canEdit = usePermission('orders:edit');
  const canExport = usePermission('orders:export');
  const { changeStatus, pendingId } = useOrderActions();
  const [bulkBusy, setBulkBusy] = useState(false);

  const status = (filters.status in ORDER_STATUS ? filters.status : 'all') as TabValue;
  const query = useMemo<ServiceFilters>(() => {
    const range = resolveRange(filters.date, filters.from, filters.to);
    const num = (v: string) => (v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
    return {
      status: status === 'all' ? '' : status,
      search: filters.search || undefined,
      paymentStatus: (filters.payment as PaymentStatus) || '',
      shippingStatus: (filters.shipping as ShippingStatus) || '',
      from: range.from,
      to: range.to,
      minTotal: num(filters.min),
      maxTotal: num(filters.max),
    };
  }, [status, filters]);

  const { data, loading, error, reload, setData } = useAsync(() => orderService.getOrders(query), [JSON.stringify(query)]);
  const counts = useAsync(() => orderService.getStatusCounts(), []);
  const tabCount = (t: TabValue) => {
    const c = counts.data;
    if (!c) return undefined;
    return t === 'shipped' ? c.shipped + c.out_for_delivery : c[t];
  };

  const extraKeys: (keyof OrderFilterValues)[] = ['date', 'from', 'to', 'payment', 'shipping', 'min', 'max'];
  const activeCount = ['date', 'payment', 'shipping', 'min', 'max'].filter((k) => filters[k as keyof OrderFilterValues]).length;
  const hasQuery = activeCount > 0 || Boolean(filters.search);
  const clearFilters = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        [...extraKeys, 'search'].forEach((k) => next.delete(k));
        return next;
      },
      { replace: true },
    );

  const applyUpdated = (o: Order) => setData((prev) => prev?.map((x) => (x.id === o.id ? o : x)));
  const onStatus = async (o: Order, s: OrderStatus) => {
    const updated = await changeStatus(o, s);
    if (updated) {
      applyUpdated(updated);
      void counts.reload(true);
      // The row may no longer belong to the active status tab — refresh quietly.
      if (status !== 'all') void reload(true);
    }
  };

  const doExport = (rows: Order[], name = 'orders') => {
    if (!rows.length) return toast.info('Nothing to export.');
    exportCsv(name, rows, ORDER_CSV);
    toast.success(`Exported ${rows.length} order${rows.length === 1 ? '' : 's'}.`);
  };

  const bulkMark = async (ids: string[], to: OrderStatus, clear: () => void) => {
    const selected = (data ?? []).filter((o) => ids.includes(o.id));
    const valid = selected.filter((o) => canTransition(o, to));
    const skipped = selected.length - valid.length;
    if (!valid.length) return toast.warning(`None of the selected orders can be marked as ${ORDER_STATUS[to].label.toLowerCase()}.`, { description: `${skipped} skipped — invalid status transition.` });
    setBulkBusy(true);
    let done = 0;
    let failed = 0;
    for (const o of valid) {
      try {
        await orderService.updateOrderStatus(o.id, to);
        done++;
      } catch {
        failed++;
      }
    }
    setBulkBusy(false);
    clear();
    const parts = [skipped && `${skipped} skipped (invalid transition)`, failed && `${failed} failed`].filter(Boolean).join(' · ');
    (failed ? toast.warning : toast.success)(`${done} order${done === 1 ? '' : 's'} marked as ${ORDER_STATUS[to].label.toLowerCase()}.`, { description: parts || undefined });
    refreshBadges();
    void counts.reload(true);
    void reload(true);
  };

  const columns: Column<Order>[] = [
    {
      id: 'number',
      header: 'Order',
      mobile: 'title',
      hideable: false,
      sortValue: (o) => o.number,
      cell: (o) => (
        <Link to={`/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap font-mono text-[0.8125rem] font-semibold text-zinc-950 hover:underline">
          #{o.number}
        </Link>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      mobile: 'subtitle',
      sortValue: (o) => o.customerName,
      cell: (o) => (
        <div className="min-w-[170px] max-w-[240px]">
          <div className="truncate font-medium text-zinc-900">{o.customerName}</div>
          <div className="truncate text-xs text-zinc-500">{o.customerEmail}</div>
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      sortValue: (o) => o.createdAt,
      cell: (o) => (
        <div className="whitespace-nowrap">
          <div className="text-zinc-800">{formatDate(o.createdAt)}</div>
          <div className="text-xs text-zinc-500 tabular">{formatTime(o.createdAt)}</div>
        </div>
      ),
    },
    { id: 'items', header: 'Items', align: 'right', sortValue: (o) => o.itemsCount, cell: (o) => <span className="tabular">{o.itemsCount}</span> },
    { id: 'total', header: 'Total', align: 'right', mobile: 'aside', sortValue: (o) => o.total, cell: (o) => <span className="whitespace-nowrap font-semibold text-zinc-950 tabular">{formatMoney(o.total)}</span> },
    {
      id: 'payment',
      header: 'Payment',
      sortValue: (o) => o.payment.status,
      cell: (o) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge map={PAYMENT_STATUS} value={o.payment.status} />
          <span className="text-xs text-zinc-500">{PAYMENT_METHOD[o.payment.method]}</span>
        </div>
      ),
    },
    { id: 'status', header: 'Status', mobile: 'aside', sortValue: (o) => o.status, cell: (o) => <StatusBadge map={ORDER_STATUS} value={o.status} /> },
    { id: 'shipping', header: 'Shipping', sortValue: (o) => o.shipping.status, cell: (o) => <StatusBadge map={SHIPPING_STATUS} value={o.shipping.status} dot={false} /> },
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        description="Track, fulfil and resolve customer orders from checkout to doorstep."
        actions={
          <>
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => {
                void reload();
                void counts.reload(true);
              }}
            >
              Refresh
            </Button>
            {canExport && (
              <Button variant="secondary" icon={Download} onClick={() => doExport(data ?? [])} disabled={loading}>
                Export CSV
              </Button>
            )}
          </>
        }
      />

      <Tabs ariaLabel="Order status" className="mb-4" items={TABS.map((t) => ({ ...t, count: tabCount(t.value) }))} value={status} onChange={(v) => setFilter('status', v === 'all' ? '' : v)} />

      <DataTable
        caption="Orders"
        storageKey="orders"
        data={data}
        columns={columns}
        getRowId={(o) => o.id}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        onRowClick={(o) => navigate(`/orders/${o.id}`)}
        selectable={canExport || canEdit}
        pageSize={20}
        initialSort={{ id: 'date', dir: 'desc' }}
        rowClassName={(o) => (pendingId === o.id ? 'opacity-60' : undefined)}
        toolbar={<OrderFilters filters={filters} setFilter={setFilter} activeCount={activeCount} onClear={clearFilters} />}
        toolbarRight={<span className="hidden text-xs text-zinc-500 tabular sm:inline">{data ? `${data.length} orders` : ''}</span>}
        bulkActions={(ids, clear) => (
          <>
            {canExport && (
              <BulkButton icon={Download} onClick={() => doExport((data ?? []).filter((o) => ids.includes(o.id)), 'orders-selection')}>
                Export selected
              </BulkButton>
            )}
            {canEdit && (
              <>
                <BulkButton icon={Timer} disabled={bulkBusy} onClick={() => void bulkMark(ids, 'processing', clear)}>
                  Mark processing
                </BulkButton>
                <BulkButton icon={PackageCheck} disabled={bulkBusy} onClick={() => void bulkMark(ids, 'packed', clear)}>
                  Mark packed
                </BulkButton>
              </>
            )}
          </>
        )}
        rowActions={(o) => <OrderRowMenu order={o} onStatus={(x, s) => void onStatus(x, s)} busy={pendingId === o.id} />}
        empty={
          hasQuery ? (
            <EmptyState icon={SearchX} title="No orders match these filters" description="Try a different search term, date range or status." action={<Button size="sm" onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState
              icon={ShoppingBag}
              title={status === 'all' ? 'No orders yet.' : `No ${ORDER_STATUS[status].label.toLowerCase()} orders.`}
              description={status === 'all' ? 'Orders placed on the SPORTX store will appear here.' : 'Orders in this status will appear here.'}
              action={status !== 'all' ? <Button size="sm" onClick={() => setFilter('status', '')}>View all orders</Button> : undefined}
            />
          )
        }
      />
    </>
  );
}
