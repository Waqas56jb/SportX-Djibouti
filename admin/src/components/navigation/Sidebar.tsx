import { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, UserRound, X } from 'lucide-react';
import { NAVIGATION, type NavItem, type NavLeaf } from '@/constants/navigation';
import { usePermissions } from '@/hooks/usePermission';
import { useUiStore } from '@/store/uiStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';
import { CountBadge, Avatar, Wordmark } from '@/components/common';
import { confirm } from '@/store/confirmStore';

function isLeafActive(leaf: NavLeaf, pathname: string, search: string) {
  const [path, query] = leaf.to.split('?');
  if (leaf.exact) {
    if (query) return pathname === path && new URLSearchParams(search).toString() === new URLSearchParams(query).toString();
    return pathname === path && !new URLSearchParams(search).get('status');
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Leaves that match by prefix (e.g. /orders/:id) also light up the "All" item. */
function isLeafActiveLoose(leaf: NavLeaf, pathname: string, search: string) {
  if (isLeafActive(leaf, pathname, search)) return true;
  const [path, query] = leaf.to.split('?');
  return !query && leaf.exact && pathname.startsWith(`${path}/`) && !NAVIGATION.some((g) => g.children?.some((c) => c !== leaf && !c.to.includes('?') && pathname.startsWith(c.to)));
}

export function Sidebar({ mobile }: { mobile?: boolean }) {
  const { pathname, search } = useLocation();
  const can = usePermissions();
  const { sidebarCollapsed, toggleSidebar, openGroups, setGroupOpen, setMobileNav } = useUiStore();
  const counts = useNotificationStore((s) => s.navCounts);
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const collapsed = sidebarCollapsed && !mobile;

  const nav = useMemo(
    () =>
      NAVIGATION.map((item) => (item.children ? { ...item, children: item.children.filter((c) => can(c.permission)) } : item)).filter((item) =>
        item.children ? item.children.length > 0 : can(item.permission),
      ),
    [can],
  );

  // Close mobile drawer on navigation.
  useEffect(() => {
    if (mobile) setMobileNav(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  const groupActive = (item: NavItem) => item.children?.some((c) => isLeafActiveLoose(c, pathname, search));

  const onLogout = async () => {
    if (await confirm({ title: 'Sign out of SPORTX Admin?', description: 'You will need to sign in again to continue.', confirmLabel: 'Sign out', tone: 'default' })) void logout();
  };

  return (
    <nav aria-label="Main navigation" className={cn('dark-surface flex h-full flex-col bg-ink-950 text-zinc-400', collapsed ? 'w-[72px]' : 'w-[264px]')}>
      <div className={cn('flex h-16 shrink-0 items-center border-b border-white/[0.06]', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
        <Link to="/dashboard" aria-label="SPORTX Admin — Dashboard" className="flex items-center gap-2.5">
          {collapsed ? (
            <Wordmark compact />
          ) : (
            <>
              <Wordmark />
              <span className="mb-3 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-300">Admin</span>
            </>
          )}
        </Link>
        {mobile && (
          <button type="button" onClick={() => setMobileNav(false)} aria-label="Close navigation" className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-dark">
        <ul className="space-y-0.5">
          {nav.map((item) => {
            const Icon = item.icon;
            const badge = item.badge ? counts[item.badge] : undefined;
            if (!item.children) {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <li key={item.id}>
                  <Link
                    to={item.to!}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[0.8125rem] font-medium transition-colors',
                      active ? 'bg-white/[0.08] text-white' : 'hover:bg-white/[0.04] hover:text-zinc-100',
                      collapsed && 'justify-center px-0',
                    )}
                  >
                    {active && <span className="absolute -left-3 top-1.5 h-6 w-[3px] rounded-r bg-volt" aria-hidden />}
                    <Icon size={17} strokeWidth={1.9} className={cn('shrink-0', active && 'text-volt')} aria-hidden />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {badge ? collapsed ? <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-volt" aria-label={`${badge} pending`} /> : <CountBadge count={badge} tone={item.id === 'support' ? 'danger' : 'dark'} /> : null}
                  </Link>
                </li>
              );
            }
            const active = groupActive(item);
            const open = collapsed ? false : openGroups[item.id] ?? Boolean(active);
            const firstTo = item.children[0].to;
            return (
              <li key={item.id}>
                {collapsed ? (
                  <Link to={firstTo} title={item.label} aria-label={item.label} className={cn('relative flex h-9 items-center justify-center rounded-lg transition-colors', active ? 'bg-white/[0.08] text-white' : 'hover:bg-white/[0.04] hover:text-zinc-100')}>
                    {active && <span className="absolute -left-3 top-1.5 h-6 w-[3px] rounded-r bg-volt" aria-hidden />}
                    <Icon size={17} strokeWidth={1.9} className={cn(active && 'text-volt')} aria-hidden />
                    {badge ? <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-volt" aria-hidden /> : null}
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setGroupOpen(item.id, !open)}
                      aria-expanded={open}
                      className={cn('flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-[0.8125rem] font-medium transition-colors hover:bg-white/[0.04] hover:text-zinc-100', active && 'text-zinc-100')}
                    >
                      <Icon size={17} strokeWidth={1.9} className={cn('shrink-0', active && 'text-volt')} aria-hidden />
                      <span className="flex-1 text-left">{item.label}</span>
                      {badge && !open ? <CountBadge count={badge} tone="dark" /> : null}
                      <ChevronDown size={14} className={cn('shrink-0 text-zinc-600 transition-transform', open && 'rotate-180')} aria-hidden />
                    </button>
                    {open && (
                      <ul className="relative mb-1 ml-[21px] mt-0.5 space-y-0.5 border-l border-white/[0.07] pl-3">
                        {item.children.map((leaf) => {
                          const on = isLeafActiveLoose(leaf, pathname, search);
                          const b = leaf.badge ? counts[leaf.badge] : item.badge && leaf.exact && !leaf.to.includes('?') ? counts[item.badge] : undefined;
                          return (
                            <li key={leaf.to}>
                              <Link
                                to={leaf.to}
                                aria-current={on ? 'page' : undefined}
                                className={cn('relative flex h-8 items-center gap-2 rounded-md px-2.5 text-[0.8125rem] transition-colors', on ? 'bg-white/[0.08] font-medium text-white' : 'hover:bg-white/[0.04] hover:text-zinc-200')}
                              >
                                {on && <span className="absolute -left-[13px] top-2 h-4 w-px bg-volt" aria-hidden />}
                                <span className="flex-1 truncate">{leaf.label}</span>
                                {b ? <CountBadge count={b} tone={leaf.badge === 'lowStock' ? 'volt' : 'dark'} /> : null}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="shrink-0 border-t border-white/[0.06] p-3">
        {!collapsed && session && (
          <Link to="/profile" className="mb-1 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.04]">
            <Avatar name={session.user.name} src={session.user.avatarUrl} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-medium text-zinc-100">{session.user.name}</span>
              <span className="block truncate text-2xs text-zinc-500">{session.role.name}</span>
            </span>
          </Link>
        )}
        <div className={cn('flex gap-1', collapsed ? 'flex-col items-center' : 'items-center')}>
          {collapsed && (
            <Link to="/profile" aria-label="Profile" title="Profile" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/[0.06] hover:text-white">
              <UserRound size={17} />
            </Link>
          )}
          <button type="button" onClick={onLogout} title="Log out" aria-label="Log out" className={cn('flex h-9 items-center gap-2.5 rounded-lg text-[0.8125rem] font-medium hover:bg-white/[0.06] hover:text-white', collapsed ? 'w-9 justify-center' : 'flex-1 px-2.5')}>
            <LogOut size={16} aria-hidden />
            {!collapsed && 'Logout'}
          </button>
          {!mobile && (
            <button type="button" onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/[0.06] hover:text-white">
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
