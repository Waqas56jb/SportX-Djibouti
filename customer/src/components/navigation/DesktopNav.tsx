import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { SmartImage } from '@/components/common';
import { getMainNav } from '@/data/navigation';
import { useT } from '@/i18n';
import type { NavLink as NavItem } from '@/types';
import { cn } from '@/utils/cn';

/** Primary navigation (dark header) with a hover/focus mega panel for Football and Clothing. */
export function DesktopNav() {
  const { t } = useT();
  const nav = useMemo(getMainNav, []);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const closeTimer = useRef<number>();
  const location = useLocation();

  useEffect(() => setOpenKey(null), [location.pathname, location.search]);

  const openMenu = (key: string) => {
    window.clearTimeout(closeTimer.current);
    setOpenKey(key);
  };
  const scheduleClose = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenKey(null), 120);
  };

  const active = nav.find((n) => n.key === openKey && n.mega);

  return (
    <nav aria-label={t('layout.nav.main')} className="hidden xl:block" onMouseLeave={scheduleClose}>
      <ul className="flex items-center gap-0.5 2xl:gap-1.5">
        {nav.map((item) => (
          <li key={item.key} onMouseEnter={() => (item.mega ? openMenu(item.key!) : scheduleClose())}>
            <NavLink
              to={item.href}
              end={item.href === '/'}
              onFocus={() => item.mega && openMenu(item.key!)}
              onKeyDown={(e) => e.key === 'Escape' && setOpenKey(null)}
              aria-haspopup={item.mega ? 'true' : undefined}
              aria-expanded={item.mega ? openKey === item.key : undefined}
              className={({ isActive }) =>
                cn(
                  'relative flex h-[84px] items-center whitespace-nowrap px-2.5 text-[12.5px] font-semibold uppercase tracking-[0.1em] transition-colors 2xl:px-3',
                  item.highlight ? 'text-accent hover:text-accent-light' : 'text-white/85 hover:text-white',
                  'after:absolute after:inset-x-2.5 after:bottom-6 after:h-[2px] after:origin-center after:scale-x-0 after:bg-current after:transition-transform after:duration-300 after:ease-premium hover:after:scale-x-100',
                  (isActive || openKey === item.key) && 'text-white after:scale-x-100',
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      {active?.mega && <MegaPanel item={active} onEnter={() => openMenu(active.key!)} onLeave={scheduleClose} onNavigate={() => setOpenKey(null)} />}
    </nav>
  );
}

function MegaPanel({ item, onEnter, onLeave, onNavigate }: { item: NavItem; onEnter: () => void; onLeave: () => void; onNavigate: () => void }) {
  const { t } = useT();
  const mega = item.mega!;
  return (
    <div className="absolute inset-x-0 top-full z-40 animate-fade-in border-t border-paper-200 bg-white text-ink shadow-lift" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div className="container-site grid grid-cols-[1fr_1fr_1fr_1.3fr] gap-10 py-10">
        {mega.columns.map((col) => (
          <div key={col.title}>
            <p className="eyebrow mb-4 text-ink">{col.title}</p>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
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
          <span className="link-underline">{t('layout.nav.shopAllOf', { name: item.label })}</span> <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
