import { useRef, useState } from 'react';
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, LogOut, Menu as MenuIcon, Plus, Search, Settings, UserRound, AlertTriangle, ShoppingBag, CreditCard, RotateCcw, LifeBuoy, UserPlus, Star, CheckCheck } from 'lucide-react';
import { ROUTE_META } from '@/constants/navigation';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { confirm } from '@/store/confirmStore';
import { usePermissions } from '@/hooks/usePermission';
import { useClickOutside } from '@/hooks/misc';
import { cn } from '@/utils/cn';
import { formatRelative } from '@/utils/format';
import { Avatar, Kbd, Menu, IconButton } from '@/components/common';
import type { NotificationType } from '@/types';
import { QUICK_ACTIONS } from './quickActions';

export const NOTIFICATION_ICON: Record<NotificationType, { icon: typeof Bell; cls: string }> = {
  low_stock: { icon: AlertTriangle, cls: 'bg-amber-50 text-amber-600' },
  new_order: { icon: ShoppingBag, cls: 'bg-zinc-100 text-zinc-700' },
  payment_failed: { icon: CreditCard, cls: 'bg-red-50 text-red-600' },
  refund_requested: { icon: RotateCcw, cls: 'bg-sky-50 text-sky-600' },
  new_ticket: { icon: LifeBuoy, cls: 'bg-violet-50 text-violet-600' },
  new_customer: { icon: UserPlus, cls: 'bg-emerald-50 text-emerald-600' },
  review_pending: { icon: Star, cls: 'bg-amber-50 text-amber-600' },
};

function useRouteMeta() {
  const { pathname } = useLocation();
  return ROUTE_META.find((m) => matchPath({ path: m.pattern, end: true }, pathname));
}

function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { items, navCounts, setRead, markAllRead } = useNotificationStore();
  useClickOutside([wrap], () => setOpen(false), open);
  const unread = navCounts.notifications ?? 0;
  const recent = items.slice(0, 6);
  return (
    <div ref={wrap} className="relative" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <IconButton icon={Bell} label={`Notifications${unread ? ` (${unread} unread)` : ''}`} badge={unread} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" />
      {open && (
        <div role="dialog" aria-label="Notifications" className="fixed inset-x-3 top-16 z-50 animate-scale-in overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[380px]">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <div className="text-sm font-semibold text-zinc-900">
              Notifications {unread > 0 && <span className="ml-1 text-xs font-medium text-zinc-500">{unread} unread</span>}
            </div>
            {unread > 0 && (
              <button type="button" onClick={() => void markAllRead()} className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-950">
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[380px] divide-y divide-zinc-100 overflow-y-auto scrollbar-thin">
            {recent.length === 0 && <li className="px-4 py-10 text-center text-sm text-zinc-500">You’re all caught up.</li>}
            {recent.map((n) => {
              const meta = NOTIFICATION_ICON[n.type];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read) void setRead([n.id], true);
                      setOpen(false);
                      if (n.link) navigate(n.link);
                    }}
                    className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-zinc-50', !n.read && 'bg-volt/[0.06]')}
                  >
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.cls)}>
                      <meta.icon size={15} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={cn('text-[0.8125rem] text-zinc-900', !n.read && 'font-semibold')}>{n.title}</span>
                        {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink-950" aria-label="Unread" />}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">{n.message}</span>
                      <span className="mt-1 block text-2xs text-zinc-400">{formatRelative(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-zinc-100 px-4 py-2.5 text-center text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const meta = useRouteMeta();
  const navigate = useNavigate();
  const setMobileNav = useUiStore((s) => s.setMobileNav);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const can = usePermissions();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const actions = QUICK_ACTIONS.filter((a) => can(a.permission));

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-zinc-200/80 bg-white/85 px-4 backdrop-blur-md sm:px-6">
      <IconButton icon={MenuIcon} label="Open navigation" className="lg:hidden" onClick={() => setMobileNav(true)} />

      <div className="hidden min-w-0 flex-1 md:block">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1 text-xs text-zinc-500">
            <li>
              <Link to="/dashboard" className="hover:text-zinc-900">
                SPORTX
              </Link>
            </li>
            {meta?.crumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                <ChevronRight size={12} className="text-zinc-300" aria-hidden />
                {c.to ? (
                  <Link to={c.to} className="hover:text-zinc-900">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={i === meta.crumbs.length - 1 ? 'page' : undefined} className={cn(i === meta.crumbs.length - 1 && 'text-zinc-700')}>
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <div className="truncate text-[0.9375rem] font-semibold tracking-tight text-zinc-950">{meta?.title ?? 'SPORTX Admin'}</div>
      </div>
      <div className="min-w-0 flex-1 truncate text-sm font-semibold md:hidden">{meta?.title}</div>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        aria-label="Search (Ctrl+K)"
        className="hidden h-9 w-72 items-center gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 text-[0.8125rem] text-zinc-400 transition-colors hover:border-zinc-300 hover:bg-white lg:flex xl:w-80"
      >
        <Search size={15} aria-hidden />
        <span className="flex-1 truncate whitespace-nowrap text-left">Search orders, products…</span>
        <span className="flex gap-0.5">
          <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <IconButton icon={Search} label="Search" className="lg:hidden" onClick={() => setCommandOpen(true)} />

      {actions.length > 0 && (
        <Menu
          label="Quick actions"
          width={220}
          header={<div className="px-2.5 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wider text-zinc-400">Quick actions</div>}
          items={actions.map((a) => ({ label: a.label, icon: a.icon, onSelect: () => navigate(a.to) }))}
          trigger={(p) => (
            <button type="button" {...p} aria-label="Quick actions" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink-950 px-2.5 text-[0.8125rem] font-medium text-white shadow-sm hover:bg-ink-800 sm:px-3">
              <Plus size={16} aria-hidden />
              <span className="hidden sm:inline">Create</span>
            </button>
          )}
        />
      )}

      <NotificationsPopover />

      {session && (
        <Menu
          label="Account"
          width={232}
          header={
            <div className="border-b border-zinc-100 px-2.5 pb-2.5 pt-1.5">
              <div className="truncate text-sm font-semibold text-zinc-900">{session.user.name}</div>
              <div className="truncate text-xs text-zinc-500">{session.user.email}</div>
              <div className="mt-1.5 inline-flex rounded bg-zinc-100 px-1.5 py-0.5 text-2xs font-semibold text-zinc-600">{session.role.name}</div>
            </div>
          }
          items={[
            { label: 'Profile', icon: UserRound, onSelect: () => navigate('/profile') },
            { label: 'Store settings', icon: Settings, onSelect: () => navigate('/settings/store'), hidden: !can('settings:view') },
            {
              label: 'Log out',
              icon: LogOut,
              separator: true,
              danger: true,
              onSelect: async () => {
                if (await confirm({ title: 'Sign out of SPORTX Admin?', description: 'You will need to sign in again to continue.', confirmLabel: 'Sign out', tone: 'default' })) void logout();
              },
            },
          ]}
          trigger={(p) => (
            <button type="button" {...p} aria-label="Account menu" className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-zinc-200">
              <Avatar name={session.user.name} src={session.user.avatarUrl} size={32} />
            </button>
          )}
        />
      )}
    </header>
  );
}
