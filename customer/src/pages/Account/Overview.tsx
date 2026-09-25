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
import { accountService, type DashboardOrder } from '@/services/accountService';
import { useAuthStore } from '@/store/authStore';
import { useRecentlyViewedStore } from '@/store/historyStores';
import { formatDate, formatPrice, formatRelative, pluralize } from '@/utils/format';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** API status (PAYMENT_CONFIRMED) → readable label ("Payment confirmed"). */
const humanize = (status: string) => status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');

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
            <p className="text-sm font-semibold">{order.orderNumber}</p>
            <Badge tone={toneFor(order.status)} dot>
              {humanize(order.status)}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-ink-500">
            {formatDate(order.placedAt)} · {pluralize(order.itemsCount, 'item')} · {order.shippingMethod}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums">{formatPrice(order.grandTotal)}</p>
      </Link>
    </li>
  );
}

export default function AccountOverviewPage() {
  usePageMeta({ title: 'My Account', noindex: true });
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
    { label: 'Total orders', value: data?.orderCounts.total, icon: Package, href: ROUTES.accountOrders },
    { label: 'In progress', value: data?.orderCounts.active, icon: Truck, href: ROUTES.accountOrders },
    { label: 'Delivered', value: data?.orderCounts.delivered, icon: PackageCheck, href: ROUTES.accountOrders },
    { label: 'Wishlist', value: data?.wishlistCount, icon: Heart, href: ROUTES.accountWishlist },
    { label: 'Saved addresses', value: data?.addressesCount, icon: MapPin, href: ROUTES.accountAddresses },
  ];

  const def = data?.defaultAddress;

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden bg-ink p-6 text-white sm:p-10">
        <p className="pointer-events-none absolute -right-4 -top-6 select-none font-display text-[9rem] font-extrabold uppercase leading-none text-white/[0.04]" aria-hidden>
          SPORTX
        </p>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{greeting()}</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold uppercase leading-none text-white sm:text-5xl">Welcome back, {user?.firstName}</h1>
        <p className="mt-3 max-w-md text-white/70">Track orders, manage your details and pick up where you left off.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink to={ROUTES.accountOrders} variant="light" size="sm">
            Track an order
          </ButtonLink>
          <ButtonLink to="/new-arrivals" variant="outline-light" size="sm">
            Shop new arrivals
          </ButtonLink>
        </div>
      </section>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <section aria-label="Account summary">
            <ul className="grid grid-cols-2 gap-px border border-paper-200 bg-paper-200 sm:grid-cols-3 xl:grid-cols-5">
              {stats.map(({ label, value, icon: Icon, href }) => (
                <li key={label} className="bg-white">
                  <Link to={href} className="group flex h-full flex-col p-5 transition-colors hover:bg-paper-50">
                    <Icon className="h-5 w-5 text-ink-500 transition-colors group-hover:text-ink" strokeWidth={1.5} aria-hidden />
                    {loading || value === undefined ? <Skeleton className="mt-4 h-9 w-12" /> : <p className="mt-4 font-display text-4xl font-bold leading-none tabular-nums">{value}</p>}
                    <p className="mt-2 text-xs uppercase tracking-[0.12em] text-ink-500">{label}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="recent-orders">
            <div className="mb-5 flex items-end justify-between">
              <h2 id="recent-orders" className="heading-md">
                Recent orders
              </h2>
              <Link to={ROUTES.accountOrders} className="group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                <span className="link-underline">All orders</span> <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            {loading || !data ? (
              <SkeletonLoader rows={2} />
            ) : data.recentOrders.length === 0 ? (
              <div className="border border-paper-200 bg-white">
                <EmptyState compact icon={<Package />} title="No orders yet" description="When you place an order, it’ll appear here." action={<ButtonLink to={ROUTES.shop}>Start shopping</ButtonLink>} />
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
            <section aria-label="Activity" className="grid gap-4 md:grid-cols-2">
              <div className="border border-paper-200 bg-white p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="heading-sm flex items-center gap-2">
                    <Bell className="h-4 w-4" aria-hidden /> Notifications
                  </h2>
                  {data.unreadNotifications > 0 && <Badge tone="accent">{data.unreadNotifications} unread</Badge>}
                </div>
                {data.recentNotifications.length === 0 ? (
                  <p className="text-sm text-ink-500">You’re all caught up.</p>
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
                  View all
                </Link>
              </div>
              <div className="border border-paper-200 bg-white p-5 sm:p-6">
                <h2 className="heading-sm mb-4 flex items-center gap-2">
                  <MapPin className="h-4 w-4" aria-hidden /> Default address
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
                    <span className="block">{def.phone}</span>
                  </address>
                ) : (
                  <p className="text-sm text-ink-500">No default address yet.</p>
                )}
                <Link to={ROUTES.accountAddresses} className="mt-4 inline-block text-xs font-semibold uppercase tracking-[0.12em] underline underline-offset-4">
                  Manage addresses
                </Link>
              </div>
            </section>
          )}
        </>
      )}

      <section aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="heading-md mb-5">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: 'Get support',
              text: data?.openTickets ? `${pluralize(data.openTickets, 'open ticket')}` : 'Open a ticket with our team',
              href: ROUTES.accountSupport,
              icon: LifeBuoy,
            },
            { label: 'Your reviews', text: data ? `${pluralize(data.reviewsCount, 'review')} written` : 'Share your thoughts', href: ROUTES.accountReviews, icon: Star },
            { label: 'View wishlist', text: 'Your saved favourites', href: ROUTES.accountWishlist, icon: Heart },
          ].map(({ label, text, href, icon: Icon }) => (
            <Link key={label} to={href} className="group flex items-center gap-4 border border-paper-200 bg-white p-5 transition-colors hover:border-ink">
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-ink-500">{text}</span>
              </span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      {recentSlugs.length > 0 && (
        <section aria-labelledby="recently-viewed">
          <h2 id="recently-viewed" className="heading-md mb-2">
            Recently viewed
          </h2>
          <ProductCarousel label="Recently viewed" products={recent.data} loading={recent.loading} cardClassName="md:w-[31%] xl:w-[31.5%]" />
        </section>
      )}
    </div>
  );
}
