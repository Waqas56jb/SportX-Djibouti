import { CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AccountSection } from '@/components/account/AccountLayout';
import { EmptyState, ErrorState, SkeletonLoader } from '@/components/common';
import { PaymentStatusBadge } from '@/components/order/OrderParts';
import { PAYMENT_METHOD_LABELS } from '@/constants/labels';
import { orderPath } from '@/constants/routes';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useT } from '@/i18n';
import { orderService } from '@/services/orderService';
import { formatDate, formatPrice } from '@/utils/format';

export default function PaymentHistoryPage() {
  const { t } = useT();
  usePageMeta({ title: t('account.payments.meta'), noindex: true });
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => orderService.listForUser({ limit: 50 }), [user?.id]);
  const orders = data ?? [];
  const paid = orders.filter((o) => o.paymentStatus === 'paid' || o.paymentStatus === 'partially-refunded').reduce((s, o) => s + o.total - (o.refunded ?? 0), 0);

  return (
    <AccountSection title={t('account.payments.title')} description={t('account.payments.description')}>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <SkeletonLoader rows={3} />
      ) : orders.length === 0 ? (
        <div className="border border-paper-200 bg-white">
          <EmptyState compact icon={<CreditCard />} title={t('account.payments.emptyTitle')} description={t('account.payments.emptyBody')} />
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-px border border-paper-200 bg-paper-200 sm:max-w-md">
            <div className="min-w-0 bg-white p-4 sm:p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-ink-500">{t('account.payments.netPaid')}</p>
              <p className="mt-2 break-words font-display text-2xl font-bold tabular-nums sm:text-3xl">{formatPrice(paid)}</p>
            </div>
            <div className="min-w-0 bg-white p-4 sm:p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-ink-500">{t('account.payments.transactions')}</p>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums sm:text-3xl">{orders.length}</p>
            </div>
          </div>

          {/* Table on desktop */}
          <div className="hidden overflow-x-auto border border-paper-200 bg-white md:block">
            <table className="w-full text-start text-sm">
              <caption className="sr-only">{t('account.payments.title')}</caption>
              <thead className="border-b border-paper-200 bg-paper-50 text-xs uppercase tracking-[0.1em] text-ink-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">{t('account.payments.date')}</th>
                  <th scope="col" className="px-5 py-3 font-semibold">{t('account.payments.order')}</th>
                  <th scope="col" className="px-5 py-3 font-semibold">{t('account.payments.method')}</th>
                  <th scope="col" className="px-5 py-3 font-semibold">{t('account.payments.reference')}</th>
                  <th scope="col" className="px-5 py-3 font-semibold">{t('account.payments.status')}</th>
                  <th scope="col" className="px-5 py-3 text-end font-semibold">{t('account.payments.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-200">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-paper-50">
                    <td className="whitespace-nowrap px-5 py-4">{formatDate(o.createdAt)}</td>
                    <td className="px-5 py-4">
                      <Link to={orderPath(o.id)} className="ltr-text font-semibold hover:underline">
                        {o.number}
                      </Link>
                    </td>
                    <td className="px-5 py-4">{(PAYMENT_METHOD_LABELS[o.payment.method] ?? o.payment.method)}</td>
                    <td className="px-5 py-4 text-ink-500">
                      <span className="ltr-text">{o.payment.reference ?? '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <PaymentStatusBadge status={o.paymentStatus} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-end font-semibold tabular-nums">{formatPrice(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards on mobile */}
          <ul className="space-y-3 md:hidden">
            {orders.map((o) => (
              <li key={o.id} className="border border-paper-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <Link to={orderPath(o.id)} className="ltr-text min-w-0 truncate text-sm font-semibold hover:underline">
                    {o.number}
                  </Link>
                  <p className="shrink-0 font-semibold tabular-nums">{formatPrice(o.total)}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-ink-500">
                  <span>
                    {formatDate(o.createdAt)} · {(PAYMENT_METHOD_LABELS[o.payment.method] ?? o.payment.method)}
                  </span>
                  <PaymentStatusBadge status={o.paymentStatus} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </AccountSection>
  );
}
