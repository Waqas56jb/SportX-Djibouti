import { ArrowLeft, Lock, Phone } from 'lucide-react';
import { Suspense, useEffect } from 'react';
import { Link, Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { Logo, PageLoader, Toaster } from '@/components/common';
import { CartDrawer } from '@/components/cart';
import { MobileMenu } from '@/components/navigation/MobileMenu';
import { SearchOverlay } from '@/components/navigation/SearchOverlay';
import { QuickViewModal } from '@/components/product';
import { ROUTES } from '@/constants/routes';
import { SITE } from '@/constants/site';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { AnnouncementBar, Header } from './Header';
import { Footer } from './Footer';
import { WishlistSync } from './WishlistSync';

function SkipLink() {
  return (
    <a href="#main" className="sr-only z-[100] bg-ink px-4 py-3 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
      Skip to content
    </a>
  );
}

/** Closes drawers/overlays whenever the route changes. */
function RouteChangeEffects() {
  const location = useLocation();
  const close = useUiStore((s) => s.close);
  const closeQuickView = useUiStore((s) => s.closeQuickView);
  useEffect(() => {
    close();
    closeQuickView();
  }, [location.pathname, close, closeQuickView]);
  return null;
}

function GlobalChrome() {
  return (
    <>
      <ScrollRestoration getKey={(location) => location.pathname} />
      <RouteChangeEffects />
      <WishlistSync />
      <Toaster />
    </>
  );
}

export function MainLayout() {
  return (
    <>
      <SkipLink />
      <GlobalChrome />
      <AnnouncementBar />
      <Header />
      <main id="main" className="min-h-[60vh]">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
      <SearchOverlay />
      <MobileMenu />
      <QuickViewModal />
    </>
  );
}

/** Distraction-free chrome for checkout — no navigation, clear way back. */
export function CheckoutLayout() {
  return (
    <>
      <SkipLink />
      <GlobalChrome />
      <header className="border-b border-paper-200 bg-white">
        <div className="container-site flex h-16 items-center justify-between gap-4 sm:h-20">
          <Link to={ROUTES.cart} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-600 hover:text-ink">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Back to bag</span>
          </Link>
          <Logo />
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-600">
            <Lock className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Secure checkout</span>
          </p>
        </div>
      </header>
      <main id="main" className="min-h-[70vh] bg-paper-50">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t border-paper-200 bg-white">
        <div className="container-site flex flex-col gap-3 py-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.name}
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <a href={SITE.contact.phoneHref} className="flex items-center gap-1.5 hover:text-ink">
              <Phone className="h-3.5 w-3.5" aria-hidden /> Need help? {SITE.contact.phone}
            </a>
            <Link to={ROUTES.privacy} className="hover:text-ink">
              Privacy
            </Link>
            <Link to={ROUTES.terms} className="hover:text-ink">
              Terms
            </Link>
          </div>
        </div>
      </footer>
      <QuickViewModal />
    </>
  );
}

/** Guards account routes; returns the visitor to the page they wanted after sign-in. */
export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const restoring = useAuthStore((s) => s.status === 'restoring');
  const location = useLocation();
  // Wait for the refresh-cookie exchange on load instead of bouncing a signed-in visitor to /login.
  if (restoring) return <PageLoader />;
  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${ROUTES.login}?redirect=${redirect}`} replace />;
  }
  return <Outlet />;
}

/** Signed-in users skip login/register. */
export function GuestOnly() {
  const { isAuthenticated } = useAuth();
  const restoring = useAuthStore((s) => s.status === 'restoring');
  const location = useLocation();
  if (restoring) return <PageLoader />;
  if (isAuthenticated) {
    const redirect = new URLSearchParams(location.search).get('redirect');
    return <Navigate to={redirect && redirect.startsWith('/') ? redirect : ROUTES.account} replace />;
  }
  return <Outlet />;
}
