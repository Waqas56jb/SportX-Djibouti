import { AlertCircle, ArrowRight, CheckCircle2, Clock, Printer, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { Button, ButtonLink, ErrorState, Logo, PageLoader } from '@/components/common';
import { CheckoutSteps, PaymentRetryPanel } from '@/components/checkout';
import { AddressBlock, OrderItemsList, OrderTotals, PaymentSummary } from '@/components/order/OrderParts';
import { ROUTES, orderPath } from '@/constants/routes';
import { SITE } from '@/constants/site';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import NotFoundPage from '@/pages/NotFound';
import { orderService } from '@/services/orderService';
import { paymentService } from '@/services/paymentService';
import { useAuthStore } from '@/store/authStore';
import type { Order } from '@/types';
import { formatDate } from '@/utils/format';

const isOnline = (o: Order) => o.payment.method === 'card' || o.payment.method === 'mobile-money';
const awaitingPayment = (o: Order) => o.status === 'payment-pending' && isOnline(o) && o.paymentStatus !== 'paid';

export default function OrderConfirmationPage() {
  const { user } = useAuth();
  const authStatus = useAuthStore((s) => s.status);
  const location = useLocation();
  usePageMeta({ title: 'Order confirmation', noindex: true });
  if (authStatus === 'restoring') return <PageLoader />;
  if (!user) return <Navigate to={`${ROUTES.login}?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  return <Confirmation />;
}

function Confirmation() {
  const { orderId = '' } = useParams();
  const { data: order, loading, error, reload, setData } = useAsync(() => orderService.getById(orderId), [orderId]);

  // A payment that was just confirmed by the provider may take a moment to reach the order (webhook).
  useEffect(() => {
    if (!order || order.paymentStatus !== 'pending' || !isOnline(order) || order.status !== 'payment-pending' || !order.payment.id) return;
    let active = true;
    paymentService
      .waitForSettlement(order.id, { timeoutMs: 8_000 })
      .then((next) => active && next && next.paymentStatus !== order.paymentStatus && setData(next))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [order, setData]);

  if (loading && !order) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} className="py-24" />;
  if (!order) return <NotFoundPage title="We can’t find that order." message="Check the link in your confirmation, or view your orders from your account." />;

  const pending = awaitingPayment(order);
  const cancelled = order.status === 'cancelled';
  const pickup = order.shipping.method.id === 'pickup' || !order.shipping.address;

  return (
    <div className="container-site py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 print:hidden">
          <CheckoutSteps current={pending ? 2 : 3} />
        </div>

        <div className="animate-fade-up text-center">
          {cancelled ? (
            <XCircle className="mx-auto h-14 w-14 text-danger" strokeWidth={1.5} aria-hidden />
          ) : pending ? (
            order.paymentStatus === 'failed' ? (
              <AlertCircle className="mx-auto h-14 w-14 text-warning" strokeWidth={1.5} aria-hidden />
            ) : (
              <Clock className="mx-auto h-14 w-14 text-warning" strokeWidth={1.5} aria-hidden />
            )
          ) : (
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" strokeWidth={1.5} aria-hidden />
          )}
          <p className="eyebrow mt-6">{cancelled ? 'Order cancelled' : pending ? 'Awaiting payment' : 'Order confirmed'}</p>
          <h1 className="heading-xl mt-3">
            {cancelled ? 'This order was cancelled' : pending ? 'Almost there' : `Thank you, ${order.customer.firstName}`}
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-ink-600">
            {cancelled ? (
              <>
                Order <strong className="font-semibold text-ink">{order.number}</strong> was cancelled{order.cancelReason ? ` — ${order.cancelReason}` : ''}. Any payment taken is refunded automatically.
              </>
            ) : pending ? (
              <>
                Order <strong className="font-semibold text-ink">{order.number}</strong> is reserved for you. Complete the payment to confirm it.
              </>
            ) : (
              <>
                Your order <strong className="font-semibold text-ink">{order.number}</strong> has been received
                {order.payment.method === 'cash-on-delivery' ? ' — you’ll pay on delivery' : ''}. A confirmation has been sent to{' '}
                <strong className="font-semibold text-ink">{order.customer.email}</strong>.
              </>
            )}
          </p>
          {!pending && (
            <div className="mt-8 flex flex-col justify-center gap-3 print:hidden sm:flex-row">
              <ButtonLink to={orderPath(order.id)} variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}>
                {cancelled ? 'View order' : 'Track order'}
              </ButtonLink>
              <ButtonLink to={ROUTES.shop} variant="outline" size="lg">
                Continue shopping
              </ButtonLink>
            </div>
          )}
        </div>

        {pending && (
          <div className="mx-auto mt-10 max-w-xl print:hidden">
            <PaymentRetryPanel order={order} onSettled={(next) => setData(next)} />
          </div>
        )}

        {/* Invoice-style summary */}
        <article className="mt-14 border border-paper-200 bg-white" aria-labelledby="invoice-title">
          <header className="flex flex-col gap-6 border-b border-paper-200 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-10">
            <div>
              <Logo asLink={false} />
              <address className="mt-4 text-xs not-italic leading-relaxed text-ink-500">
                {SITE.contact.addressLines.join(', ')}
                <br />
                {SITE.contact.phone}
              </address>
            </div>
            <div className="sm:text-right">
              <h2 id="invoice-title" className="heading-sm">
                Order summary
              </h2>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex gap-2 sm:justify-end">
                  <dt className="text-ink-500">Order no.</dt>
                  <dd className="font-semibold">{order.number}</dd>
                </div>
                <div className="flex gap-2 sm:justify-end">
                  <dt className="text-ink-500">Date</dt>
                  <dd>{formatDate(order.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
                </div>
                {order.shipping.expectedDelivery && !cancelled && (
                  <div className="flex gap-2 sm:justify-end">
                    <dt className="text-ink-500">{pickup ? 'Ready by' : 'Expected delivery'}</dt>
                    <dd className="font-semibold text-success">{formatDate(order.shipping.expectedDelivery, { weekday: 'short', day: 'numeric', month: 'short' })}</dd>
                  </div>
                )}
              </dl>
            </div>
          </header>

          <div className="grid gap-8 border-b border-paper-200 p-6 sm:grid-cols-3 sm:p-10">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em]">Customer</p>
              <p className="text-sm leading-relaxed text-ink-600">
                <span className="block font-medium text-ink">
                  {order.customer.firstName} {order.customer.lastName}
                </span>
                <span className="block">{order.customer.email}</span>
                <span className="block">{order.customer.phone}</span>
              </p>
            </div>
            {order.shipping.address ? (
              <AddressBlock address={order.shipping.address} title={pickup ? 'Billing address' : 'Shipping address'} />
            ) : (
              <div className="text-sm leading-relaxed text-ink-600">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink">{order.shipping.method.name}</p>
                <p>Collect from SPORTX, {SITE.contact.addressLines.slice(0, 2).join(', ')}. We’ll contact you when it’s ready.</p>
              </div>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em]">Payment</p>
              <PaymentSummary order={order} />
            </div>
          </div>

          <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1fr_340px]">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em]">Items</p>
              <OrderItemsList items={order.items} />
            </div>
            <div className="lg:border-l lg:border-paper-200 lg:pl-10">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em]">Totals</p>
              <OrderTotals order={order} />
            </div>
          </div>
        </article>

        <div className="mt-6 flex justify-end print:hidden">
          <Button variant="ghost" size="sm" onClick={() => window.print()} leftIcon={<Printer className="h-4 w-4" />}>
            Print summary
          </Button>
        </div>
      </div>
    </div>
  );
}
