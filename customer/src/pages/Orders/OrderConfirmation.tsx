import { ArrowRight, CheckCircle2, Printer } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Button, ButtonLink, ErrorState, Logo, PageLoader } from '@/components/common';
import { CheckoutSteps } from '@/components/checkout';
import { AddressBlock, OrderItemsList, OrderTotals, PaymentSummary } from '@/components/order/OrderParts';
import { ROUTES, orderPath } from '@/constants/routes';
import { SITE } from '@/constants/site';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import NotFoundPage from '@/pages/NotFound';
import { orderService } from '@/services';
import { formatDate } from '@/utils/format';

export default function OrderConfirmationPage() {
  const { orderId = '' } = useParams();
  const { data: order, loading, error, reload } = useAsync(() => orderService.getById(orderId), [orderId]);
  usePageMeta({ title: 'Order confirmed', noindex: true });

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} className="py-24" />;
  if (!order) return <NotFoundPage title="We can’t find that order." message="Check the link in your confirmation, or view your orders from your account." />;

  return (
    <div className="container-site py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 print:hidden">
          <CheckoutSteps current={3} />
        </div>

        <div className="animate-fade-up text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-success" strokeWidth={1.5} aria-hidden />
          <p className="eyebrow mt-6">Order confirmed</p>
          <h1 className="heading-xl mt-3">Thank you, {order.customer.firstName}</h1>
          <p className="mx-auto mt-4 max-w-lg text-ink-600">
            Your order <strong className="font-semibold text-ink">{order.number}</strong> has been received. A confirmation has been sent to{' '}
            <strong className="font-semibold text-ink">{order.customer.email}</strong>.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 print:hidden sm:flex-row">
            <ButtonLink to={orderPath(order.id)} variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}>
              Track order
            </ButtonLink>
            <ButtonLink to={ROUTES.shop} variant="outline" size="lg">
              Continue shopping
            </ButtonLink>
          </div>
        </div>

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
                <div className="flex gap-2 sm:justify-end">
                  <dt className="text-ink-500">Expected delivery</dt>
                  <dd className="font-semibold text-success">{formatDate(order.shipping.expectedDelivery, { weekday: 'short', day: 'numeric', month: 'short' })}</dd>
                </div>
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
            <AddressBlock address={order.shipping.address} title={order.shipping.method.id === 'pickup' ? 'Collect from store' : 'Shipping address'} />
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
