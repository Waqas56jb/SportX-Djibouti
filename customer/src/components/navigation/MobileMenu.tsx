import { ChevronRight, Heart, MapPin, Package, Phone, User, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Drawer, Logo, SmartImage } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { SITE } from '@/constants/site';
import { FEATURED_CATEGORIES } from '@/data/categories';
import { MAIN_NAV } from '@/data/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';

export function MobileMenu() {
  const open = useUiStore((s) => s.overlay === 'menu');
  const close = useUiStore((s) => s.close);
  const { user } = useAuth();

  return (
    <Drawer open={open} onClose={close} side="left" title="Menu" hideHeader className="max-w-[min(100%,420px)]">
      <div className="flex min-h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b border-paper-200 px-5">
          <Logo size="sm" onClick={close} />
          <button type="button" onClick={close} className="icon-btn -mr-2" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-paper-200 bg-paper-50 px-5 py-4">
          <Link to={user ? ROUTES.account : ROUTES.login} onClick={close} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white">
              <User className="h-4 w-4" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">{user ? `Hi, ${user.firstName}` : 'Sign in or join'}</span>
              <span className="block text-xs text-ink-500">{user ? 'View your account' : 'Track orders, save favourites'}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-ink-500" aria-hidden />
          </Link>
        </div>

        <nav aria-label="Mobile" className="px-5 py-3">
          <ul>
            {MAIN_NAV.map((item, i) => (
              <li key={item.label} className="animate-fade-up" style={{ animationDelay: `${60 + i * 30}ms` }}>
                <Link
                  to={item.href}
                  onClick={close}
                  className={cn(
                    'flex items-center justify-between border-b border-paper-200 py-3.5 font-display text-[1.65rem] font-bold uppercase leading-none tracking-tight',
                    item.highlight ? 'text-accent-dark' : 'text-ink',
                  )}
                >
                  {item.label}
                  <ChevronRight className="h-5 w-5 text-ink-500" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-5 py-4">
          <p className="eyebrow mb-3">Shop by sport</p>
          <div className="scrollbar-none -mx-5 flex gap-3 overflow-x-auto px-5">
            {FEATURED_CATEGORIES.map((c) => (
              <Link key={c.slug} to={c.href} onClick={close} className="relative aspect-[3/4] w-28 shrink-0 overflow-hidden">
                <SmartImage src={c.image} alt="" sizes="112px" maxWidth={320} wrapperClassName="absolute inset-0" />
                <span className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
                <span className="absolute bottom-2 left-2 font-display text-lg font-bold uppercase text-white">{c.name}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-auto space-y-1 border-t border-paper-200 px-5 py-5 text-sm">
          <Link to={ROUTES.accountOrders} onClick={close} className="flex items-center gap-3 py-2">
            <Package className="h-4 w-4" aria-hidden /> Orders
          </Link>
          <Link to={ROUTES.wishlist} onClick={close} className="flex items-center gap-3 py-2">
            <Heart className="h-4 w-4" aria-hidden /> Wishlist
          </Link>
          <a href={SITE.contact.phoneHref} className="flex items-center gap-3 py-2">
            <Phone className="h-4 w-4" aria-hidden /> {SITE.contact.phone}
          </a>
          <Link to={ROUTES.contact} onClick={close} className="flex items-start gap-3 py-2">
            <MapPin className="mt-0.5 h-4 w-4" aria-hidden />
            <span className="text-ink-600">{SITE.contact.addressLines.join(', ')}</span>
          </Link>
        </div>
      </div>
    </Drawer>
  );
}
