import { Bell, Heart, Menu, Search, ShoppingBag, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LanguageSwitcher, Logo } from '@/components/common';
import { DesktopNav } from '@/components/navigation/DesktopNav';
import { ROUTES } from '@/constants/routes';
import { SITE } from '@/constants/site';
import { useAuth } from '@/hooks/useAuth';
import { useScrollHeader } from '@/hooks/useUi';
import { useT } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { selectCartCount, useCartStore } from '@/store/cartStore';
import { useUiStore } from '@/store/uiStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { cn } from '@/utils/cn';

function CountBadge({ count, tone = 'accent' }: { count: number; tone?: 'accent' | 'light' }) {
  if (count <= 0) return null;
  return (
    <span
      key={count}
      className={cn(
        'absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] animate-badge-bump items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none',
        tone === 'accent' ? 'bg-accent text-ink' : 'bg-white text-ink',
      )}
      aria-hidden
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Header icon button on the dark bar. */
const darkIcon = 'icon-btn text-white hover:bg-white/10';

export function AnnouncementBar() {
  const { t } = useT();
  return (
    <div className="border-b border-white/10 bg-ink-950 text-white">
      <div className="container-site flex h-9 items-center justify-center gap-3 text-[10px] font-semibold uppercase tracking-[0.08em] xs:text-[11px] sm:justify-between sm:tracking-[0.18em]">
        <a href={SITE.contact.phoneHref} className="ltr-text hidden text-white/60 transition-colors hover:text-white lg:block">
          {SITE.contact.phone}
        </a>
        <p className="truncate text-center">
          {t('common.site.announcement')}
          <span className="mx-3 hidden text-accent sm:inline" aria-hidden>
            |
          </span>
          <Link to={ROUTES.shop} className="hidden underline-offset-4 hover:underline sm:inline">
            {t('common.site.announcementCta')}
          </Link>
        </p>
        <div className="hidden items-center gap-5 text-white/60 lg:flex">
          <Link to={ROUTES.faq} className="transition-colors hover:text-white">
            {t('layout.header.help')}
          </Link>
          <Link to={ROUTES.contact} className="transition-colors hover:text-white">
            {t('layout.header.store')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const { t } = useT();
  const { hidden, scrolled } = useScrollHeader();
  const overlay = useUiStore((s) => s.overlay);
  const open = useUiStore((s) => s.open);
  const cartCount = useCartStore(selectCartCount);
  const wishCount = useWishlistStore((s) => s.items.length);
  const { user } = useAuth();
  const unread = useAuthStore((s) => s.unreadNotifications);

  const accountHref = user ? ROUTES.account : ROUTES.login;

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b bg-ink/95 text-white backdrop-blur-md transition-[transform,box-shadow,border-color] duration-300 ease-premium supports-[backdrop-filter]:bg-ink/90',
        scrolled ? 'border-white/10 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.6)]' : 'border-transparent',
        hidden && !overlay && '-translate-y-full',
      )}
    >
      <div className="container-site flex h-[68px] items-center justify-between gap-3 sm:h-[76px] xl:h-[84px]">
        {/* Start: menu (mobile/tablet) + logo */}
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <button type="button" className={cn(darkIcon, '-ms-2.5 xl:hidden')} onClick={() => open('menu')} aria-label={t('common.actions.openMenu')} aria-expanded={overlay === 'menu'}>
            <Menu className="h-6 w-6" />
          </button>
          <Logo />
        </div>

        <DesktopNav />

        {/* End: actions */}
        <div className="flex items-center justify-end gap-0.5">
          <LanguageSwitcher className="hidden sm:block" />
          <button type="button" className={darkIcon} onClick={() => open('search')} aria-label={t('layout.header.search')} aria-expanded={overlay === 'search'}>
            <Search className="h-[21px] w-[21px]" />
          </button>
          <Link to={accountHref} className={cn(darkIcon, 'hidden sm:inline-flex')} aria-label={user ? t('layout.header.account') : t('layout.header.signIn')}>
            <User className="h-[21px] w-[21px]" />
            {user && <span className="absolute bottom-2 end-2 h-2 w-2 rounded-full border border-ink bg-success" aria-hidden />}
          </Link>
          {user && (
            <Link
              to="/account/notifications"
              className={cn(darkIcon, 'hidden sm:inline-flex')}
              aria-label={unread > 0 ? t('layout.header.notificationsUnread', { count: unread }) : t('layout.header.notifications')}
            >
              <Bell className="h-[21px] w-[21px]" />
              <CountBadge count={unread} />
            </Link>
          )}
          <Link to={ROUTES.wishlist} className={cn(darkIcon, 'hidden sm:inline-flex')} aria-label={t('layout.header.wishlist', { count: wishCount })}>
            <Heart className="h-[21px] w-[21px]" />
            <CountBadge count={wishCount} tone="light" />
          </Link>
          <button type="button" className={cn(darkIcon, '-me-2.5')} onClick={() => open('cart')} aria-label={t('layout.header.bag', { count: cartCount })} aria-expanded={overlay === 'cart'}>
            <ShoppingBag className="h-[21px] w-[21px]" />
            <CountBadge count={cartCount} />
          </button>
        </div>
      </div>
    </header>
  );
}
