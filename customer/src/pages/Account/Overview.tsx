import { ArrowRight, Bell, Heart, LifeBuoy, MapPin, Package, PackageCheck, Star, Truck } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Badge, ButtonLink, EmptyState, ErrorState, Skeleton, SkeletonLoader, SmartImage } from '@/components/common';
import { ProductCarousel } from '@/components/product';
import { ROUTES, orderPath } from '@/constants/routes';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useProductsBySlugs } from '@/hooks/useProducts';
import { t, useT } from '@/i18n';
import { accountService, type DashboardOrder } from '@/services/accountService';
import { useAuthStore } from '@/store/authStore';
import { useRecentlyViewedStore } from '@/store/historyStores';
import { ORDER_STATUS_LABELS } from '@/constants/labels';
import type { OrderStatus } from '@/types';
import { formatDate, formatPrice, formatRelative } from '@/utils/format';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? t('account.overview.morning') : h < 18 ? t('account.overview.afternoon') : t('account.overview.evening');
}

/** API status (PAYMENT_CONFIRMED) → translated label, falling back to a readable form of the raw value. */
const statusLabel = (status: string) => {
  const key = status.toLowerCase().replace(/_/g, '-') as OrderStatus;
  return (key in ORDER_STATUS_LABELS ? ORDER_STATUS_LABELS[key] : undefined) ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
};

const toneFor = (status: string) =>
  status === 'DELIVERED' ? 'success' : status === 'CANCELLED' || status === 'REFUNDED' ? 'danger' : status === 'SHIPPED' || status === 'OUT_FOR_DELIVERY' ? 'accent' : 'neutral';

function RecentOrderRow({ order }: { order: DashboardOrder }) {
  return (
    <li>
      <Link to={orderPath(order.id)} className="flex items-center gap-4 p-4 transition-colors hover:bg-paper-50 sm:p-5">
        <div className="relative h-16 w-14 shrink-0 overflow-hidden bg-paper-100">
          {order.image ? (
            <SmartImage src={order.image} alt="" sizes="56px" maxWidth={320} wrapperClassName="absolute inset-0" />
          ) : (
            <Package className="absolute inset-0 m-auto h-5 w-5 text-ink-500" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="ltr-text text-sm font-semibold">{order.orderNumber}</p>
            <Badge tone={toneFor(order.status)} dot>
              {statusLabel(order.status)}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-ink-500">
            {formatDate(order.placedAt)} · {t('common.labels.items', { count: order.itemsCount })} · {order.shippingMethod}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums">{formatPrice(order.grandTotal)}</p>
      </Link>
    </li>
  );
}

export default function AccountOverviewPage() {
  useT();
  usePageMeta({ title: t('account.overview.meta'), noindex: true });
  const { user, setUser } = useAuth();
  const setUnread = useAuthStore((s) => s.setUnread);
  const { data, loading, error, reload } = useAsync(() => accountService.dashboard(), [user?.id]);
  const recentSlugs = useRecentlyViewedStore((s) => s.slugs).slice(0, 8);
  const recent = useProductsBySlugs(recentSlugs);

  // The dashboard carries the freshest profile and unread count — keep the header in step.
  useEffect(() => {
    if (!data) return;
    setUnread(data.unreadNotifications);
    setUser(data.user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const stats = [
    { label: t('account.overview.totalOrders'), value: data?.orderCounts.total, icon: Package, href: ROUTES.accountOrders },
    { label: t('account.overview.inProgress'), value: data?.orderCounts.active, icon: Truck, href: ROUTES.accountOrders },
    { label: t('account.overview.delivered'), value: data?.orderCounts.delivered, icon: PackageCheck, href: ROUTES.accountOrders },
    { label: t('account.overview.wishlist'), value: data?.wishlistCount, icon: Heart, href: ROUTES.accountWishlist },
    { label: t('account.overview.savedAddresses'), value: data?.addressesCount, icon: MapPin, href: ROUTES.accountAddresses },
  ];

  const def = data?.defaultAddress;

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden bg-ink p-6 text-white sm:p-10">
        <p className="pointer-events-none absolute -end-4 -top-6 select-none font-display text-[9rem] font-extrabold uppercase leading-none text-white/[0.04]" aria-hidden>
          SPORTX
        </p>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{greeting()}</p>
        <h1 className="mt-3 break-words font-display text-4xl font-extrabold uppercase leading-none text-white sm:text-5xl">{t('account.overview.welcome', { name: user?.firstName ?? '' })}</h1>
        <p className="mt-3 max-w-md text-white/70">{t('account.overview.intro')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink to={ROUTES.accountOrders} variant="light" size="sm">
            {t('account.overview.trackOrder')}
          </ButtonLink>
          <ButtonLink to="/new-arrivals" variant="outline-light" size="sm">
            {t('account.overview.shopNew')}
          </ButtonLink>
        </div>
      </section>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <section aria-label={t('account.overview.summaryLabel')}>
            <ul className="grid grid-cols-2 gap-px border border-paper-200 bg-paper-200 sm:grid-cols-3 xl:grid-cols-5">
              {stats.map(({ label, value, icon: Icon, href }) => (
                <li key={label} className="bg-white">
                  <Link to={href} className="group flex h-full flex-col p-5 transition-colors hover:bg-paper-50">
                    <Icon className="h-5 w-5 text-ink-500 transition-colors group-hover:text-ink" strokeWidth={1.5} aria-hidden />
                    {loading || value === undefined ? <Skeleton className="mt-4 h-9 w-12" /> : <p className="mt-4 font-display text-4xl font-bold leading-none tabular-nums">{value}</p>}
                    <p className="mt-2 break-words text-xs uppercase tracking-[0.12em] text-ink-500">{label}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="recent-orders">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <h2 id="recent-orders" className="heading-md">
                {t('account.overview.recentOrders')}
              </h2>
              <Link to={ROUTES.accountOrders} className="group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                <span className="link-underline">{t('account.overview.allOrders')}</span> <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            {loading || !data ? (
              <SkeletonLoader rows={2} />
            ) : data.recentOrders.length === 0 ? (
              <div className="border border-paper-200 bg-white">
                <EmptyState compact icon={<Package />} title={t('account.overview.noOrders')} description={t('account.overview.noOrdersBody')} action={<ButtonLink to={ROUTES.shop}>{t('account.overview.startShopping')}</ButtonLink>} />
              </div>
            ) : (
              <ul className="divide-y divide-paper-200 border border-paper-200 bg-white">
                {data.recentOrders.slice(0, 3).map((o) => (
                  <RecentOrderRow key={o.id} order={o} />
                ))}
              </ul>
            )}
          </section>

          {data && (
            <section aria-label={t('account.overview.activityLabel')} className="grid gap-4 md:grid-cols-2">
              <div className="border border-paper-200 bg-white p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="heading-sm flex items-center gap-2">
                    <Bell className="h-4 w-4" aria-hidden /> {t('account.overview.notifications')}
                  </h2>
                  {data.unreadNotifications > 0 && <Badge tone="accent">{t('account.overview.unreadBadge', { count: data.unreadNotifications })}</Badge>}
                </div>
                {data.recentNotifications.length === 0 ? (
                  <p className="text-sm text-ink-500">{t('account.overview.caughtUp')}</p>
                ) : (
                  <ul className="space-y-3">
                    {data.recentNotifications.slice(0, 3).map((n) => (
                      <li key={n.id} className="text-sm">
                        <p className={n.read ? 'text-ink-600' : 'font-semibold'}>{n.title}</p>
                        <p className="text-xs text-ink-500">{formatRelative(n.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <Link to="/account/notifications" className="mt-4 inline-block text-xs font-semibold uppercase tracking-[0.12em] underline underline-offset-4">
                  {t('common.actions.viewAll')}
                </Link>
              </div>
              <div className="border border-paper-200 bg-white p-5 sm:p-6">
                <h2 className="heading-sm mb-4 flex items-center gap-2">
                  <MapPin className="h-4 w-4" aria-hidden /> {t('account.overview.defaultAddress')}
                </h2>
                {def ? (
                  <address className="text-sm not-italic leading-relaxed text-ink-600">
                    <span className="block font-medium text-ink">
                      {def.firstName} {def.lastName}
                    </span>
                    <span className="block">{def.addressLine1 ?? def.line1}</span>
                    <span className="block">
                      {def.district ? `${def.district}, ` : ''}
                      {def.city}, {def.country}
                    </span>
                    <span className="ltr-text block">{def.phone}</span>
                  </address>
                ) : (
                  <p className="text-sm text-ink-500">{t('account.overview.noDefaultAddress')}</p>
                )}
                <Link to={ROUTES.accountAddresses} className="mt-4 inline-block text-xs font-semibold uppercase tracking-[0.12em] underline underline-offset-4">
                  {t('account.overview.manageAddresses')}
                </Link>
              </div>
            </section>
          )}
        </>
      )}

      <section aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="heading-md mb-5">
          {t('account.overview.quickActions')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: t('account.overview.getSupport'),
              text: data?.openTickets ? t('account.overview.openTickets', { count: data.openTickets }) : t('account.overview.openTicketCta'),
              href: ROUTES.accountSupport,
              icon: LifeBuoy,
            },
            {
              label: t('account.overview.yourReviews'),
              text: data?.reviewsCount ? t('account.overview.reviewsWritten', { count: data.reviewsCount }) : t('account.overview.shareThoughts'),
              href: ROUTES.accountReviews,
              icon: Star,
            },
            { label: t('account.overview.viewWishlist'), text: t('account.overview.savedFavourites'), href: ROUTES.accountWishlist, icon: Heart },
          ].map(({ label, text, href, icon: Icon }) => (
            <Link key={label} to={href} className="group flex items-center gap-4 border border-paper-200 bg-white p-5 transition-colors hover:border-ink">
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-ink-500">{text}</span>
              </span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      {recentSlugs.length > 0 && (
        <section aria-labelledby="recently-viewed">
          <h2 id="recently-viewed" className="heading-md mb-2">
            {t('account.overview.recentlyViewed')}
          </h2>
          <ProductCarousel label={t('account.overview.recentlyViewed')} products={recent.data} loading={recent.loading} cardClassName="md:w-[31%] xl:w-[31.5%]" />
        </section>
      )}
    </div>
  );
}
