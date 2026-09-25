import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, className, tone = 'dark' }: { items: Crumb[]; className?: string; tone?: 'dark' | 'light' }) {
  const all: Crumb[] = [{ label: 'Home', href: '/' }, ...items];
  return (
    <nav aria-label="Breadcrumb" className={cn('text-xs', className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {all.map((c, i) => {
          const last = i === all.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {c.href && !last ? (
                <Link to={c.href} className={cn('link-underline', tone === 'light' ? 'text-white/70 hover:text-white' : 'text-ink-500 hover:text-ink')}>
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={cn('font-medium', tone === 'light' ? 'text-white' : 'text-ink')}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight className={cn('h-3 w-3', tone === 'light' ? 'text-white/40' : 'text-ink-500/60')} aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
