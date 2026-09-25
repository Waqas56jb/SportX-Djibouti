import { Heart, Menu, Search, ShoppingBag, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/common';
import { DesktopNav } from '@/components/navigation/DesktopNav';
import { ROUTES } from '@/constants/routes';
import { SITE } from '@/constants/site';
import { useAuth } from '@/hooks/useAuth';
import { useScrollHeader } from '@/hooks/useUi';
import { selectCartCount, useCartStore } from '@/store/cartStore';
import { useUiStore } from '@/store/uiStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { cn } from '@/utils/cn';

function CountBadge({ count, tone = 'accent' }: { count: number; tone?: 'accent' | 'dark' }) {
  if (count <= 0) return null;
  return (
    <span
      key={count}
      className={cn(
        'absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] animate-badge-bump items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none',
        tone === 'accent' ? 'bg-accent text-ink' : 'bg-ink text-white',
      )}
      aria-hidden
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function AnnouncementBar() {
  const [left, right] = SITE.announcement.split('|').map((s) => s.trim());
  return (
    <div className="bg-ink text-white">
      <div className="container-site flex h-9 items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] sm:justify-between">
        <a href={SITE.contact.phoneHref} className="hidden text-white/60 transition-colors hover:text-white lg:block">
          {SITE.contact.phone}
        </a>
        <p className="text-center">
          {left}
          <span className="mx-3 hidden text-accent sm:inline" aria-hidden>
            |
          </span>
          <Link to={ROUTES.shop} className="hidden underline-offset-4 hover:underline sm:inline">
            {right}
          </Link>
        </p>
        <div className="hidden items-center gap-5 text-white/60 lg:flex">
          <Link to={ROUTES.faq} className="transition-colors hover:text-white">
            Help
          </Link>
          <Link to={ROUTES.contact} className="transition-colors hover:text-white">
            Store
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const { hidden, scrolled } = useScrollHeader();
  const overlay = useUiStore((s) => s.overlay);
  const open = useUiStore((s) => s.open);
  const cartCount = useCartStore(selectCartCount);
  const wishCount = useWishlistStore((s) => s.items.length);
  const { user } = useAuth();

  const accountHref = user ? ROUTES.account : ROUTES.login;

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b bg-white/95 backdrop-blur-md transition-[transform,box-shadow,border-color] duration-300 ease-premium supports-[backdrop-filter]:bg-white/85',
        scrolled ? 'border-paper-200 shadow-[0_1px_0_rgba(0,0,0,0.02),0_8px_24px_-18px_rgba(0,0,0,0.25)]' : 'border-transparent',
        hidden && !overlay && '-translate-y-full',
      )}
    >
      <div className="container-site relative flex h-16 items-center justify-between gap-4 xl:h-[72px]">
        {/* Left: menu (mobile/tablet) + logo */}
        <div className="flex flex-1 items-center gap-1 xl:flex-none">
          <button type="button" className="icon-btn -ml-2.5 xl:hidden" onClick={() => open('menu')} aria-label="Open menu" aria-expanded={overlay === 'menu'}>
            <Menu className="h-[22px] w-[22px]" />
          </button>
          <Logo className="absolute left-1/2 -translate-x-1/2 sm:static sm:ml-2 sm:translate-x-0 xl:ml-0" />
        </div>

        <DesktopNav />

        {/* Right: actions */}
        <div className="flex flex-1 items-center justify-end gap-0.5 xl:flex-none">
          <button type="button" className="icon-btn" onClick={() => open('search')} aria-label="Search" aria-expanded={overlay === 'search'}>
            <Search className="h-[21px] w-[21px]" />
          </button>
          <Link to={accountHref} className="icon-btn hidden sm:inline-flex" aria-label={user ? 'My account' : 'Sign in'}>
            <User className="h-[21px] w-[21px]" />
            {user && <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full border border-white bg-success" aria-hidden />}
          </Link>
          <Link to={ROUTES.wishlist} className="icon-btn hidden sm:inline-flex" aria-label={`Wishlist, ${wishCount} items`}>
            <Heart className="h-[21px] w-[21px]" />
            <CountBadge count={wishCount} tone="dark" />
          </Link>
          <button type="button" className="icon-btn -mr-2.5" onClick={() => open('cart')} aria-label={`Bag, ${cartCount} items`} aria-expanded={overlay === 'cart'}>
            <ShoppingBag className="h-[21px] w-[21px]" />
            <CountBadge count={cartCount} />
          </button>
        </div>
      </div>
    </header>
  );
}
