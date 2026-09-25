import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useClickOutside } from '@/hooks/misc';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  /** Render a divider above this item. */
  separator?: boolean;
  hint?: string;
}

export interface MenuProps {
  items: MenuItem[];
  /** Custom trigger. Receives props that must be spread onto a button. */
  trigger?: (p: { ref: (el: HTMLButtonElement | null) => void; onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode;
  label?: string;
  align?: 'start' | 'end';
  width?: number;
  header?: ReactNode;
}

/** Accessible dropdown menu rendered in a portal (never clipped by table overflow). */
export function Menu({ items, trigger, label = 'Actions', align = 'end', width = 200, header }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean }>({ top: 0, left: 0, up: false });
  const btn = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement>(null);
  const visible = items.filter((i) => !i.hidden);

  useClickOutside([menu, btn as React.RefObject<HTMLElement>], () => setOpen(false), open);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      const h = menu.current?.offsetHeight ?? 240;
      const up = r.bottom + h + 8 > window.innerHeight && r.top > h + 8;
      const left = align === 'end' ? Math.max(8, r.right - width) : Math.min(r.left, window.innerWidth - width - 8);
      setPos({ top: up ? r.top - h - 4 : r.bottom + 4, left, up });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, align, width]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus());
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    const els = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []);
    const idx = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      setOpen(false);
      btn.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(idx + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(idx - 1 + els.length) % els.length]?.focus();
    } else if (e.key === 'Tab') setOpen(false);
  };

  const triggerProps = {
    ref: (el: HTMLButtonElement | null) => (btn.current = el),
    onClick: () => setOpen((o) => !o),
    'aria-expanded': open,
    'aria-haspopup': 'menu' as const,
  };

  return (
    <>
      {trigger ? (
        trigger(triggerProps)
      ) : (
        <button
          type="button"
          {...triggerProps}
          aria-label={label}
          title={label}
          onClick={(e) => {
            e.stopPropagation();
            triggerProps.onClick();
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 aria-expanded:bg-zinc-100 aria-expanded:text-zinc-900"
        >
          <MoreHorizontal size={17} aria-hidden />
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={label}
            onKeyDown={onKey}
            onClick={(e) => e.stopPropagation()}
            style={{ top: pos.top, left: pos.left, width }}
            className="fixed z-[70] animate-scale-in overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-pop"
          >
            {header}
            {visible.map((item, i) => (
              <div key={item.label + i}>
                {item.separator && i > 0 && <div className="my-1 h-px bg-zinc-100" role="separator" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.8125rem] font-medium outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    item.danger ? 'text-red-600 hover:bg-red-50 focus:bg-red-50' : 'text-zinc-700 hover:bg-zinc-100 focus:bg-zinc-100',
                  )}
                >
                  {item.icon && <item.icon size={15} aria-hidden className={item.danger ? '' : 'text-zinc-400'} />}
                  <span className="flex-1">{item.label}</span>
                  {item.hint && <span className="text-2xs text-zinc-400">{item.hint}</span>}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
