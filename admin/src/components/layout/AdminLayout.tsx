import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/navigation/Sidebar';
import { Topbar } from '@/components/navigation/Topbar';
import { CommandPalette } from '@/components/navigation/CommandPalette';
import { PageSkeleton } from '@/components/common/States';
import { useUiStore } from '@/store/uiStore';
import { useNotificationStore } from '@/store/notificationStore';
import { cn } from '@/utils/cn';
import { RouteErrorBoundary } from './ErrorBoundary';

export function AdminLayout() {
  const { sidebarCollapsed, mobileNavOpen, setMobileNav } = useUiStore();
  const { load, refreshCounts } = useNotificationStore();
  const location = useLocation();

  useEffect(() => {
    void load();
    void refreshCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep sidebar badges fresh as admins work through queues.
  useEffect(() => {
    void refreshCounts();
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && setMobileNav(false);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [mobileNavOpen, setMobileNav]);

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-pop">
        Skip to content
      </a>

      {/* Desktop: fixed sidebar */}
      <aside className={cn('no-print fixed inset-y-0 left-0 z-40 hidden lg:block', sidebarCollapsed ? 'w-[72px]' : 'w-[264px]')}>
        <Sidebar />
      </aside>

      {/* Mobile / tablet: drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 animate-fade-in bg-ink-950/60" onClick={() => setMobileNav(false)} aria-hidden />
          <div className="relative h-full w-[280px] max-w-[85vw] animate-slide-in-left">
            <Sidebar mobile />
          </div>
        </div>
      )}

      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200', sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[264px]')}>
        <Topbar />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8">
          <RouteErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
        <footer className="no-print border-t border-zinc-200/70 px-4 py-4 text-2xs text-zinc-400 sm:px-8">
          SPORTX Admin · Place Menelik, Rue de Ras Makonnen, Djibouti
        </footer>
      </div>
      <CommandPalette />
    </div>
  );
}
