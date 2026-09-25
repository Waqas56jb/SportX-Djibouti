import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CornerDownLeft, FolderTree, LifeBuoy, Loader2, Package, Search, ShoppingBag, Users, Zap } from 'lucide-react';
import { searchService, type SearchGroup, type SearchResult } from '@/services/searchService';
import { useUiStore } from '@/store/uiStore';
import { useDebounce, useHotkey } from '@/hooks/misc';
import { usePermissions } from '@/hooks/usePermission';
import { cn } from '@/utils/cn';
import { Kbd, ProductThumb } from '@/components/common/Misc';
import { QUICK_ACTIONS } from './quickActions';
import type { PermissionKey } from '@/types';

const GROUPS: Record<SearchGroup, { label: string; icon: typeof Package; permission: PermissionKey }> = {
  orders: { label: 'Orders', icon: ShoppingBag, permission: 'orders:view' },
  products: { label: 'Products', icon: Package, permission: 'products:view' },
  customers: { label: 'Customers', icon: Users, permission: 'customers:view' },
  tickets: { label: 'Support tickets', icon: LifeBuoy, permission: 'support:view' },
  categories: { label: 'Categories', icon: FolderTree, permission: 'categories:view' },
};

type Entry = { kind: 'result'; r: SearchResult } | { kind: 'action'; id: string; label: string; to: string; icon: typeof Package };

/** Global Ctrl/Cmd+K search across orders, products, customers, tickets and categories. */
export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const navigate = useNavigate();
  const can = usePermissions();
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 160);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useHotkey('k', (e) => {
    e.preventDefault();
    setOpen(!useUiStore.getState().commandOpen);
  }, { meta: true });

  useEffect(() => {
    if (!open) return;
    setQ('');
    setResults([]);
    setActive(0);
    const prev = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => input.current?.focus());
    return () => prev?.focus?.();
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    if (dq.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    searchService.search(dq).then((r) => {
      if (cancelled) return;
      setResults(r.filter((x) => can(GROUPS[x.group].permission)));
      setLoading(false);
      setActive(0);
    });
    return () => {
      cancelled = true;
    };
  }, [dq, can]);

  const actions = QUICK_ACTIONS.filter((a) => can(a.permission) && (!q || a.label.toLowerCase().includes(q.toLowerCase())));
  const entries: Entry[] = useMemo(
    () => [...results.map((r) => ({ kind: 'result' as const, r })), ...(q.trim().length < 2 || actions.length ? actions.map((a) => ({ kind: 'action' as const, id: a.id, label: a.label, to: a.to, icon: a.icon })) : [])],
    [results, actions, q],
  );

  const go = (e: Entry) => {
    setOpen(false);
    navigate(e.kind === 'result' ? e.r.to : e.to);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(entries.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && entries[active]) {
      e.preventDefault();
      go(entries[active]);
    } else if (e.key === 'Escape') setOpen(false);
  };

  useEffect(() => {
    list.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  let idx = -1;
  const grouped = (Object.keys(GROUPS) as SearchGroup[]).map((g) => ({ g, items: results.filter((r) => r.group === g) })).filter((x) => x.items.length);

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-start justify-center px-3 pt-[10vh]">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Search" className="relative w-full max-w-2xl animate-scale-in overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-pop" onKeyDown={onKey}>
        <div className="flex items-center gap-3 border-b border-zinc-100 px-4">
          {loading ? <Loader2 size={18} className="animate-spin text-zinc-400" aria-hidden /> : <Search size={18} className="text-zinc-400" aria-hidden />}
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search orders, products, customers, tickets…  e.g. SPX-10245, Nike, John"
            aria-label="Search the admin"
            aria-controls="cmd-results"
            aria-activedescendant={entries[active] ? `cmd-${active}` : undefined}
            className="h-14 flex-1 bg-transparent text-[0.9375rem] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={list} id="cmd-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
          {q.trim().length >= 2 && !loading && results.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-zinc-800">No results for “{q}”</p>
              <p className="mt-1 text-xs text-zinc-500">Try an order number (SPX-10245), SKU, product, brand, customer name, email or phone.</p>
            </div>
          )}
          {grouped.map(({ g, items }) => {
            const G = GROUPS[g];
            return (
              <div key={g} className="mb-1">
                <div className="flex items-center gap-2 px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-zinc-400">
                  <G.icon size={12} aria-hidden /> {G.label}
                </div>
                {items.map((r) => {
                  idx++;
                  const i = idx;
                  return (
                    <button
                      key={r.group + r.id}
                      id={`cmd-${i}`}
                      data-idx={i}
                      role="option"
                      aria-selected={active === i}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go({ kind: 'result', r })}
                      className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left', active === i ? 'bg-zinc-100' : '')}
                    >
                      {r.image ? <ProductThumb src={r.image} alt="" size={32} /> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500"><G.icon size={15} aria-hidden /></span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-900">{r.title}</span>
                        <span className="block truncate text-xs text-zinc-500">{r.subtitle}</span>
                      </span>
                      {r.meta && <span className="hidden shrink-0 text-xs text-zinc-500 sm:block">{r.meta}</span>}
                      {active === i && <CornerDownLeft size={14} className="shrink-0 text-zinc-400" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {actions.length > 0 && (q.trim().length < 2 || results.length === 0 || actions.length) && (
            <div>
              <div className="flex items-center gap-2 px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-zinc-400">
                <Zap size={12} aria-hidden /> Quick actions
              </div>
              {actions.map((a) => {
                idx++;
                const i = idx;
                return (
                  <button key={a.id} id={`cmd-${i}`} data-idx={i} role="option" aria-selected={active === i} type="button" onMouseEnter={() => setActive(i)} onClick={() => go({ kind: 'action', id: a.id, label: a.label, to: a.to, icon: a.icon })} className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left', active === i && 'bg-zinc-100')}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-950 text-volt">
                      <a.icon size={15} aria-hidden />
                    </span>
                    <span className="flex-1 text-sm font-medium text-zinc-900">{a.label}</span>
                    <ArrowRight size={14} className="text-zinc-400" aria-hidden />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-zinc-100 bg-zinc-50/70 px-4 py-2 text-2xs text-zinc-500">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
          <span className="ml-auto flex items-center gap-1"><Kbd>Ctrl</Kbd><Kbd>K</Kbd> toggle</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
