import { Bell, CreditCard, Heart, LayoutDashboard, LifeBuoy, LogOut, MapPin, Package, Settings, Star } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { PageLoader } from '@/components/common';
import { useT, type TKey } from '@/i18n';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';

/** Account navigation. `labelKey` is translated at render time. */
export const ACCOUNT_NAV: { labelKey: TKey; href: string; icon: typeof Bell; end?: boolean }[] = [
  { labelKey: 'account.nav.overview', href: ROUTES.account, icon: LayoutDashboard, end: true },
  { labelKey: 'account.nav.orders', href: ROUTES.accountOrders, icon: Package },
  { labelKey: 'account.nav.wishlist', href: ROUTES.accountWishlist, icon: Heart },
  { labelKey: 'account.nav.addresses', href: ROUTES.accountAddresses, icon: MapPin },
  { labelKey: 'account.nav.reviews', href: ROUTES.accountReviews, icon: Star },
  { labelKey: 'account.nav.payments', href: ROUTES.accountPayments, icon: CreditCard },
  { labelKey: 'account.nav.notifications', href: '/account/notifications', icon: Bell },
  { labelKey: 'account.nav.support', href: ROUTES.accountSupport, icon: LifeBuoy },
  { labelKey: 'account.nav.settings', href: ROUTES.accountSettings, icon: Settings },
];

export function AccountLayout() {
  const { user, logout } = useAuth();
  const unread = useAuthStore((s) => s.unreadNotifications);
  const navigate = useNavigate();
  const { t } = useT();

  const signOut = async () => {
    await logout();
    toast.info(t('account.nav.signedOut'));
    navigate(ROUTES.home);
  };

  if (!user) return null;

  return (
    <div className="bg-paper-50">
      <div className="border-b border-paper-200 bg-white">
        <div className="container-site flex items-center gap-4 py-8 sm:py-10">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover sm:h-16 sm:w-16" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink font-display text-xl font-bold text-white sm:h-16 sm:w-16 sm:text-2xl">
              {initials(user.firstName, user.lastName)}
            </span>
          )}
          <div className="min-w-0">
            <p className="eyebrow">{t('account.nav.myAccount')}</p>
            <p className="truncate font-display text-3xl font-bold uppercase leading-none sm:text-4xl">
              {user.firstName} {user.lastName}
            </p>
          </div>
        </div>
        {/* Mobile / tablet tab navigation */}
        <nav aria-label={t('account.nav.label')} className="lg:hidden">
          <ul className="container-site scrollbar-none flex gap-5 overflow-x-auto overscroll-x-contain sm:gap-6">
            {ACCOUNT_NAV.map((item) => (
              <li key={item.href} className="shrink-0">
                <NavLink
                  to={item.href}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'relative flex h-12 items-center whitespace-nowrap text-xs font-semibold uppercase tracking-[0.12em] transition-colors',
                      isActive ? 'text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-ink' : 'text-ink-500',
                    )
                  }
                >
                  {t(item.labelKey)}
                  {item.href === '/account/notifications' && <UnreadDot count={unread} />}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="container-site grid grid-cols-1 gap-10 py-8 sm:py-12 lg:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr] xl:gap-14">
        <aside className="hidden lg:block">
          <nav aria-label={t('account.nav.label')} className="sticky top-24">
            <ul className="space-y-0.5">
              {ACCOUNT_NAV.map(({ labelKey, href, icon: Icon, end }) => (
                <li key={href}>
                  <NavLink
                    to={href}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-[44px] items-center gap-3 border-s-2 px-4 text-sm font-medium transition-colors',
                        isActive ? 'border-ink bg-white text-ink' : 'border-transparent text-ink-500 hover:bg-white hover:text-ink',
                      )
                    }
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {t(labelKey)}
                    {href === '/account/notifications' && <UnreadDot count={unread} className="ms-auto" />}
                  </NavLink>
                </li>
              ))}
            </ul>
            <button type="button" onClick={signOut} className="mt-6 flex min-h-[44px] w-full items-center gap-3 border-t border-paper-200 px-4 pt-6 text-sm font-medium text-ink-500 hover:text-danger">
              <LogOut className="h-4 w-4" aria-hidden /> {t('common.actions.signOut')}
            </button>
          </nav>
        </aside>
        <div className="min-w-0">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
          <button type="button" onClick={signOut} className="mt-12 flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-danger lg:hidden">
            <LogOut className="h-4 w-4" aria-hidden /> {t('common.actions.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}

function UnreadDot({ count, className }: { count: number; className?: string }) {
  const { t } = useT();
  if (count <= 0) return null;
  return (
    <span className={cn('ms-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-ink', className)}>
      {count > 99 ? '99+' : count}
      <span className="sr-only"> {t('account.nav.unread')}</span>
    </span>
  );
}

export function AccountSection({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="heading-lg">{title}</h1>
          {description && <p className="mt-2 text-ink-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
