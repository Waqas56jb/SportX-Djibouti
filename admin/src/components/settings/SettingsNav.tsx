import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bell, CreditCard, History, ShieldCheck, Store, Truck, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SettingsNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  { to: '/settings/store', label: 'Store', icon: Store },
  { to: '/settings/shipping', label: 'Shipping', icon: Truck },
  { to: '/settings/payments', label: 'Payments', icon: CreditCard },
  { to: '/settings/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings/admin-users', label: 'Admin Users', icon: Users },
  { to: '/settings/roles', label: 'Roles & Permissions', icon: ShieldCheck },
  { to: '/settings/activity', label: 'Activity Log', icon: History },
];

/** Horizontal, scrollable sub-navigation shared by every settings screen. */
export function SettingsNav({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the active tab visible on narrow screens.
  useEffect(() => {
    const active = scroller.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  return (
    <nav aria-label="Settings sections" className={cn('no-print mb-6', className)}>
      <div ref={scroller} className="-mx-4 overflow-x-auto px-4 scrollbar-thin sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-zinc-200">
          {SETTINGS_NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-2 whitespace-nowrap rounded-t-lg px-3 pb-3 pt-2 text-sm font-medium transition-colors',
                    isActive ? 'text-zinc-950' : 'text-zinc-500 hover:bg-zinc-100/70 hover:text-zinc-800',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={15} aria-hidden className={isActive ? 'text-zinc-900' : 'text-zinc-400'} />
                    {label}
                    {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink-950" aria-hidden />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
