import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { SmartImage } from '@/components/common';
import { MAIN_NAV } from '@/data/navigation';
import type { NavLink as NavItem } from '@/types';
import { cn } from '@/utils/cn';

/** Primary navigation with a hover/focus mega panel for Men and Women. */
export function DesktopNav() {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const closeTimer = useRef<number>();
  const location = useLocation();

  useEffect(() => setOpenLabel(null), [location.pathname, location.search]);

  const openMenu = (label: string) => {
    window.clearTimeout(closeTimer.current);
    setOpenLabel(label);
  };
  const scheduleClose = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenLabel(null), 120);
  };

  const active = MAIN_NAV.find((n) => n.label === openLabel && n.mega);

  return (
    <nav aria-label="Main" className="hidden xl:block" onMouseLeave={scheduleClose}>
      <ul className="flex items-center gap-0.5 2xl:gap-1.5">
        {MAIN_NAV.map((item) => (
          <li key={item.label} onMouseEnter={() => (item.mega ? openMenu(item.label) : scheduleClose())}>
            <NavLink
              to={item.href}
              end={item.href === '/'}
              onFocus={() => item.mega && openMenu(item.label)}
              onKeyDown={(e) => e.key === 'Escape' && setOpenLabel(null)}
              aria-haspopup={item.mega ? 'true' : undefined}
              aria-expanded={item.mega ? openLabel === item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'relative flex h-[72px] items-center px-2.5 text-[12.5px] font-semibold uppercase tracking-[0.1em] transition-colors 2xl:px-3',
                  item.highlight ? 'text-accent-dark hover:text-accent' : 'text-ink hover:text-ink-600',
                  'after:absolute after:inset-x-2.5 after:bottom-5 after:h-[2px] after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 after:ease-premium hover:after:scale-x-100',
                  (isActive || openLabel === item.label) && 'after:scale-x-100',
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      {active?.mega && <MegaPanel item={active} onEnter={() => openMenu(active.label)} onLeave={scheduleClose} onNavigate={() => setOpenLabel(null)} />}
    </nav>
  );
}

function MegaPanel({ item, onEnter, onLeave, onNavigate }: { item: NavItem; onEnter: () => void; onLeave: () => void; onNavigate: () => void }) {
  const mega = item.mega!;
  return (
    <div className="absolute inset-x-0 top-full z-40 animate-fade-in border-t border-paper-200 bg-white shadow-lift" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div className="container-site grid grid-cols-[1fr_1fr_1fr_1.3fr] gap-10 py-10">
        {mega.columns.map((col) => (
          <div key={col.title}>
            <p className="eyebrow mb-4 text-ink">{col.title}</p>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.href} onClick={onNavigate} className="text-[15px] text-ink-600 transition-colors hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <Link to={mega.feature.href} onClick={onNavigate} className="group relative block aspect-[16/10] overflow-hidden">
          <SmartImage src={mega.feature.image} alt="" sizes="30vw" wrapperClassName="absolute inset-0" className="transition-transform duration-700 ease-premium group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
          <div className="absolute inset-x-5 bottom-5 text-white">
            <p className="font-display text-2xl font-bold uppercase leading-none">{mega.feature.title}</p>
            <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
              {mega.feature.subtitle} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </p>
          </div>
        </Link>
        <Link to={item.href} onClick={onNavigate} className="col-span-4 -mt-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
          <span className="link-underline">Shop all {item.label}</span> <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
