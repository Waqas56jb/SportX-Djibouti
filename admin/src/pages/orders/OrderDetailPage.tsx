import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Download, FileSearch, Printer, RotateCcw, XCircle } from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import { orderService } from '@/services/orderService';
import { useAsync } from '@/hooks/useAsync';
import { usePermission } from '@/hooks/usePermission';
import { ORDER_STATUS, PAYMENT_STATUS, SHIPPING_STATUS } from '@/constants/status';
import { formatDateTime, formatRelative } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { Button, EmptyState, ErrorState, PageHeader, StatusBadge } from '@/components/common';
import { OrderActivityPanel } from '@/components/orders/OrderActivityPanel';
import { OrderCustomerPanel } from '@/components/orders/OrderCustomerPanel';
import { OrderDetailSkeleton } from '@/components/orders/OrderDetailSkeleton';
import { OrderItemsPanel } from '@/components/orders/OrderItemsPanel';
import { OrderPaymentPanel } from '@/components/orders/OrderPaymentPanel';
import { OrderProgressPanel } from '@/components/orders/OrderProgressPanel';
import { OrderShippingPanel } from '@/components/orders/OrderShippingPanel';
import { RefundModal } from '@/components/orders/RefundModal';
import { downloadInvoice } from '@/components/orders/invoice';
import { canCancel, canRefund, nextStatuses, STATUS_ACTION_LABEL } from '@/components/orders/orderMeta';
import { cloneOrder, useOrderActions } from '@/components/orders/useOrderActions';

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const canEdit = usePermission('orders:edit');
  const canApprove = usePermission('orders:approve');
  const { data: order, loading, error, reload, setData } = useAsync(async () => cloneOrder(await orderService.getOrder(id)), [id]);
  const { changeStatus, pendingId, cancelDialog } = useOrderActions();
  const [refundOpen, setRefundOpen] = useState(false);

  if (loading && !order) return <OrderDetailSkeleton />;
  if (error || !order) {
    const notFound = (error as { status?: number } | null)?.status === 404;
    return (
      <>
        <PageHeader title={notFound ? 'Order not found' : 'Order'} backTo="/orders" backLabel="Orders" />
        <div className="panel">
          {notFound ? (
            <EmptyState
              icon={FileSearch}
              title="We couldn’t find this order."
              description={`No order matches “${id}”. It may have been removed, or the link is incorrect.`}
              action={
                <Button variant="primary" size="sm" onClick={() => navigate('/orders')}>
                  Back to orders
                </Button>
              }
            />
          ) : (
            <ErrorState description="We couldn’t load this order. Please try again." onRetry={() => void reload()} />
          )}
        </div>
      </>
    );
  }

  const busy = pendingId === order.id;
  const next = nextStatuses(order)[0];
  const update = (o: Order) => setData(o);
  const onStatus = async (s: OrderStatus, note?: string) => {
    const updated = await changeStatus(order, s, note);
    if (updated) update(updated);
    return Boolean(updated);
  };

  return (
    <>
      <PageHeader
        backTo="/orders"
        backLabel="Orders"
        documentTitle={`Order ${order.number}`}
        title={
          <span>
            Order <span className="font-mono tracking-tight">#{order.number}</span>
          </span>
        }
        meta={
          <>
            <StatusBadge map={ORDER_STATUS} value={order.status} size="md" prefix="Order" />
            <StatusBadge map={PAYMENT_STATUS} value={order.payment.status} size="md" prefix="Payment" />
            <StatusBadge map={SHIPPING_STATUS} value={order.shipping.status} size="md" dot={false} prefix="Shipping" />
            <span className="text-[0.8125rem] text-zinc-500">
              Placed {formatDateTime(order.createdAt)} <span className="text-zinc-400">({formatRelative(order.createdAt)})</span>
            </span>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
            <Button
              variant="secondary"
              icon={Download}
              onClick={() => {
                void downloadInvoice(order).then(() => toast.success('Invoice downloaded.', { description: 'Open the file in a browser to print or save as PDF.' }));
              }}
            >
              Invoice
            </Button>
            {canApprove && canRefund(order) && (
              <Button variant="secondary" icon={RotateCcw} onClick={() => setRefundOpen(true)}>
                Refund
              </Button>
            )}
            {canEdit && canCancel(order) && (
              <Button variant="danger-ghost" icon={XCircle} disabled={busy} onClick={() => void onStatus('cancelled')}>
                Cancel order
              </Button>
            )}
            {canEdit && next && (
              <Button variant="primary" iconRight={ArrowRight} loading={busy} onClick={() => void onStatus(next)}>
                {STATUS_ACTION_LABEL[next]}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-3 print:block">
        <div className="min-w-0 space-y-5 lg:col-span-2 print:space-y-4">
          <OrderProgressPanel order={order} onStatus={onStatus} busy={busy} />
          <OrderItemsPanel order={order} />
          <div className="print:hidden">
            <OrderActivityPanel order={order} onChange={update} />
          </div>
        </div>
        <div className="min-w-0 space-y-5 print:mt-4 print:space-y-4">
          <OrderCustomerPanel order={order} />
          <OrderPaymentPanel order={order} onRefund={() => setRefundOpen(true)} onChange={update} />
          <OrderShippingPanel order={order} onChange={update} onStatus={(s) => void onStatus(s)} busy={busy} />
        </div>
      </div>

      {canApprove && <RefundModal open={refundOpen} order={order} onClose={() => setRefundOpen(false)} onDone={update} />}
      {cancelDialog}
    </>
  );
}
