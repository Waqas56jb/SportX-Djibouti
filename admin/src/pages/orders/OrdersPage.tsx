import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, PackageCheck, RefreshCw, SearchX, ShoppingBag, Timer } from 'lucide-react';
import type { Order, OrderFilters as ServiceFilters, OrderSortField, OrderStatus, PaymentMethod, PaymentStatus, ShippingStatus } from '@/types';
import { orderService } from '@/services/orderService';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePermission } from '@/hooks/usePermission';
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, SHIPPING_STATUS } from '@/constants/status';
import { exportCsv } from '@/utils/csv';
import { formatDate, formatMoney, formatTime } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { Button, EmptyState, PageHeader, StatusBadge, Tabs } from '@/components/common';
import { BulkButton, DataTable, type Column, type SortState } from '@/components/tables';
import { OrderFilters, type OrderFilterValues } from '@/components/orders/OrderFilters';
import { OrderRowMenu } from '@/components/orders/OrderRowMenu';
import { ORDER_CSV, canTransition, resolveRange } from '@/components/orders/orderMeta';
import { refreshBadges, useOrderActions } from '@/components/orders/useOrderActions';

type TabValue = OrderStatus | 'all';
const TABS: { value: TabValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'payment_pending', label: 'Awaiting payment' },
  { value: 'payment_confirmed', label: 'Paid' },
  { value: 'processing', label: 'Processing' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'refund_requested', label: 'Refund requests' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];
const DEFAULTS: OrderFilterValues = { status: '', search: '', date: '', from: '', to: '', payment: '', method: '', shipping: '', min: '', max: '' };
const URL_DEFAULTS = { ...DEFAULTS, page: '', size: '', sort: '' };

/** Table column → server sort field. */
const SORT_FIELD: Record<string, OrderSortField> = { number: 'order_number', date: 'placed_at', total: 'grand_total', status: 'status' };
const DEFAULT_SORT: SortState = { id: 'date', dir: 'desc' };
const DEFAULT_SIZE = 20;

export default function OrdersPage() {
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const { filters, setFilters } = useUrlFilters(URL_DEFAULTS);
  const canEdit = usePermission('orders:edit');
  const canExport = usePermission('orders:export');
  const { changeStatus, pendingId, cancelDialog } = useOrderActions();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  /** Any filter change returns to the first page. */
  const setFilter = (k: keyof OrderFilterValues, v: string) => setFilters({ [k]: v, page: '' });
  const page = Math.max(1, Math.floor(Number(filters.page)) || 1);
  const pageSize = [10, 20, 50, 100].includes(Number(filters.size)) ? Number(filters.size) : DEFAULT_SIZE;
  const sort = useMemo<SortState>(() => {
    const [id, dir] = filters.sort.split(':');
    return id in SORT_FIELD && (dir === 'asc' || dir === 'desc') ? { id, dir } : DEFAULT_SORT;
  }, [filters.sort]);

  const status = (filters.status in ORDER_STATUS ? filters.status : 'all') as TabValue;
  const query = useMemo<ServiceFilters>(() => {
    const range = resolveRange(filters.date, filters.from, filters.to);
    const num = (v: string) => (v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : undefined);
    return {
      status: status === 'all' ? '' : status,
      search: filters.search || undefined,
      paymentStatus: (filters.payment as PaymentStatus) || '',
      paymentMethod: (filters.method as PaymentMethod) || '',
      shippingStatus: (filters.shipping as ShippingStatus) || '',
      from: range.from,
      to: range.to,
      minTotal: num(filters.min),
      maxTotal: num(filters.max),
      sortBy: SORT_FIELD[sort.id],
      sortDir: sort.dir,
    };
  }, [status, filters.search, filters.payment, filters.method, filters.shipping, filters.date, filters.from, filters.to, filters.min, filters.max, sort]);

  const list = useAsync(() => orderService.listOrders({ ...query, page, pageSize }), [JSON.stringify(query), page, pageSize]);
  const { loading, error, reload } = list;
  const data = list.data?.data;
  const total = list.data?.total ?? 0;
  const setRows = (fn: (rows: Order[]) => Order[]) => list.setData((prev) => (prev ? { ...prev, data: fn(prev.data) } : prev));

  const counts = useAsync(() => orderService.getStatusCounts(), []);
  const tabCount = (t: TabValue) => {
    const c = counts.data;
    if (!c) return undefined;
    return t === 'shipped' ? (c.shipped ?? 0) + (c.out_for_delivery ?? 0) : c[t];
  };

  const extraKeys: (keyof OrderFilterValues)[] = ['date', 'from', 'to', 'payment', 'method', 'shipping', 'min', 'max'];
  const activeCount = (['date', 'payment', 'method', 'shipping', 'min', 'max'] as const).filter((k) => filters[k]).length;
  const hasQuery = activeCount > 0 || Boolean(filters.search);
  const clearFilters = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        [...extraKeys, 'search', 'page'].forEach((k) => next.delete(k));
        return next;
      },
      { replace: true },
    );

  const onStatus = async (o: Order, s: OrderStatus) => {
    const updated = await changeStatus(o, s);
    if (updated) {
      setRows((rows) => rows.map((x) => (x.id === updated.id ? { ...updated, summary: true } : x)));
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

  /** Exports every order matching the current filters (walks the server pages, capped at 5,000 rows). */
  const exportAll = async () => {
    setExporting(true);
    try {
      const rows: Order[] = [];
      for (let p = 1; p <= 50; p++) {
        const res = await orderService.listOrders({ ...query, page: p, pageSize: 100 });
        rows.push(...res.data);
        if (rows.length >= res.total || res.data.length < 100) break;
      }
      doExport(rows);
    } catch (e) {
      toast.error('Export failed.', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setExporting(false);
    }
  };

  const bulkMark = async (ids: string[], to: OrderStatus, clear: () => void) => {
    const selected = (data ?? []).filter((o) => ids.includes(o.id));
    const valid = selected.filter((o) => canTransition(o, to));
    const skipped = selected.length - valid.length;
    if (!valid.length) return toast.warning(`None of the selected orders can be marked as ${ORDER_STATUS[to].label.toLowerCase()}.`, { description: `${skipped} skipped — invalid status transition.` });
    setBulkBusy(true);
    let done = 0;
    const errors: string[] = [];
    for (const o of valid) {
      try {
        await orderService.updateOrderStatus(o.id, to);
        done++;
      } catch (e) {
        errors.push(`${o.number}: ${e instanceof Error ? e.message : 'failed'}`);
      }
    }
    setBulkBusy(false);
    clear();
    const parts = [skipped && `${skipped} skipped (invalid transition)`, errors.length && `${errors.length} failed — ${errors.slice(0, 2).join('; ')}`].filter(Boolean).join(' · ');
    (errors.length ? toast.warning : toast.success)(`${done} order${done === 1 ? '' : 's'} marked as ${ORDER_STATUS[to].label.toLowerCase()}.`, { description: parts || undefined });
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
    { id: 'items', header: 'Items', align: 'right', cell: (o) => <span className="tabular">{o.itemsCount}</span> },
    { id: 'total', header: 'Total', align: 'right', mobile: 'aside', sortValue: (o) => o.total, cell: (o) => <span className="whitespace-nowrap font-semibold text-zinc-950 tabular">{formatMoney(o.total)}</span> },
    {
      id: 'payment',
      header: 'Payment',
      cell: (o) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge map={PAYMENT_STATUS} value={o.payment.status} />
          <span className="text-xs text-zinc-500">{PAYMENT_METHOD[o.payment.method] ?? o.payment.method}</span>
        </div>
      ),
    },
    { id: 'status', header: 'Status', mobile: 'aside', sortValue: (o) => o.status, cell: (o) => <StatusBadge map={ORDER_STATUS} value={o.status} /> },
    { id: 'shipping', header: 'Shipping', cell: (o) => <StatusBadge map={SHIPPING_STATUS} value={o.shipping.status} dot={false} /> },
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
              <Button variant="secondary" icon={Download} onClick={() => void exportAll()} loading={exporting} disabled={loading || !total}>
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
        pageSize={pageSize}
        sort={sort}
        onSortChange={(s) => setFilters({ sort: s.id === DEFAULT_SORT.id && s.dir === DEFAULT_SORT.dir ? '' : `${s.id}:${s.dir}`, page: '' })}
        serverPagination={{
          page,
          pageSize,
          total,
          onPageChange: (p) => setFilters({ page: p <= 1 ? '' : String(p) }),
          onPageSizeChange: (n) => setFilters({ size: n === DEFAULT_SIZE ? '' : String(n), page: '' }),
        }}
        rowClassName={(o) => (pendingId === o.id ? 'opacity-60' : undefined)}
        toolbar={<OrderFilters filters={filters} setFilter={setFilter} activeCount={activeCount} onClear={clearFilters} />}
        toolbarRight={<span className="hidden text-xs text-zinc-500 tabular sm:inline">{list.data ? `${total.toLocaleString()} order${total === 1 ? '' : 's'}` : ''}</span>}
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
      {cancelDialog}
    </>
  );
}
