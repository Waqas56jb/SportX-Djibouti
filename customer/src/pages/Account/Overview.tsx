import { ArrowRight, Heart, LifeBuoy, MapPin, Package, PackageCheck, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonLink, EmptyState, ErrorState, Skeleton, SkeletonLoader } from '@/components/common';
import { OrderCard } from '@/components/order/OrderCard';
import { ProductCarousel } from '@/components/product';
import { ROUTES } from '@/constants/routes';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useProductsBySlugs } from '@/hooks/useProducts';
import { useReorder } from '@/hooks/useReorder';
import { useWishlist } from '@/hooks/useWishlist';
import { addressService, orderService } from '@/services';
import { useRecentlyViewedStore } from '@/store/historyStores';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function AccountOverviewPage() {
  usePageMeta({ title: 'My Account', noindex: true });
  const { user } = useAuth();
  const orders = useAsync(() => orderService.listForUser(user!.id, user!.email), [user?.id]);
  const addresses = useAsync(() => addressService.list(user!.id), [user?.id]);
  const { count: wishCount } = useWishlist();
  const reorder = useReorder();
  const recentSlugs = useRecentlyViewedStore((s) => s.slugs).slice(0, 8);
  const recent = useProductsBySlugs(recentSlugs);

  const list = orders.data ?? [];
  const pending = list.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
  const delivered = list.filter((o) => o.status === 'delivered').length;

  const stats = [
    { label: 'Total orders', value: list.length, icon: Package, href: ROUTES.accountOrders },
    { label: 'In progress', value: pending, icon: Truck, href: ROUTES.accountOrders },
    { label: 'Delivered', value: delivered, icon: PackageCheck, href: ROUTES.accountOrders },
    { label: 'Wishlist', value: wishCount, icon: Heart, href: ROUTES.accountWishlist },
    { label: 'Saved addresses', value: addresses.data?.length ?? 0, icon: MapPin, href: ROUTES.accountAddresses },
  ];

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

      <section aria-label="Account summary">
        <ul className="grid grid-cols-2 gap-px border border-paper-200 bg-paper-200 sm:grid-cols-3 xl:grid-cols-5">
          {stats.map(({ label, value, icon: Icon, href }) => (
            <li key={label} className="bg-white">
              <Link to={href} className="group flex h-full flex-col p-5 transition-colors hover:bg-paper-50">
                <Icon className="h-5 w-5 text-ink-500 transition-colors group-hover:text-ink" strokeWidth={1.5} aria-hidden />
                {orders.loading && label !== 'Wishlist' ? (
                  <Skeleton className="mt-4 h-9 w-12" />
                ) : (
                  <p className="mt-4 font-display text-4xl font-bold leading-none tabular-nums">{value}</p>
                )}
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
        {orders.error ? (
          <ErrorState message={orders.error} onRetry={orders.reload} />
        ) : orders.loading ? (
          <SkeletonLoader rows={2} />
        ) : list.length === 0 ? (
          <div className="border border-paper-200 bg-white">
            <EmptyState compact icon={<Package />} title="No orders yet" description="When you place an order, it’ll appear here." action={<ButtonLink to={ROUTES.shop}>Start shopping</ButtonLink>} />
          </div>
        ) : (
          <div className="space-y-4">
            {list.slice(0, 2).map((o) => (
              <OrderCard key={o.id} order={o} onReorder={reorder} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="heading-md mb-5">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Manage addresses', text: 'Add or update delivery details', href: ROUTES.accountAddresses, icon: MapPin },
            { label: 'Get support', text: 'Open a ticket with our team', href: ROUTES.accountSupport, icon: LifeBuoy },
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
