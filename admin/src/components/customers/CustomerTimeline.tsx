import { Link } from 'react-router-dom';
import { Heart, LifeBuoy, LogIn, ShieldAlert, ShoppingBag, Star, UserPlus, type LucideIcon } from 'lucide-react';
import type { CustomerActivity } from '@/types';
import { EmptyState, ErrorState, Panel, SkeletonText } from '@/components/common';
import { customerService } from '@/services/customerService';
import { useAsync } from '@/hooks/useAsync';
import { cn } from '@/utils/cn';
import { formatDateTime, formatRelative } from '@/utils/format';

const ICON: Record<CustomerActivity['type'], { icon: LucideIcon; cls: string }> = {
  account_created: { icon: UserPlus, cls: 'bg-emerald-50 text-emerald-600' },
  order_placed: { icon: ShoppingBag, cls: 'bg-ink-950 text-volt' },
  review_posted: { icon: Star, cls: 'bg-amber-50 text-amber-600' },
  ticket_opened: { icon: LifeBuoy, cls: 'bg-violet-50 text-violet-600' },
  wishlist_added: { icon: Heart, cls: 'bg-rose-50 text-rose-600' },
  status_changed: { icon: ShieldAlert, cls: 'bg-zinc-100 text-zinc-600' },
  login: { icon: LogIn, cls: 'bg-sky-50 text-sky-600' },
};

/** Chronological activity feed: orders, reviews, tickets and admin changes. */
export function CustomerTimeline({ customerId, refreshKey = 0 }: { customerId: string; refreshKey?: number }) {
  const { data, loading, error, reload } = useAsync(() => customerService.getActivity(customerId), [customerId, refreshKey]);
  const items = data?.slice(0, 12) ?? [];
  return (
    <Panel title="Customer activity" description="Most recent first">
      {loading ? (
        <SkeletonText lines={6} />
      ) : error ? (
        <ErrorState compact onRetry={() => void reload()} />
      ) : items.length === 0 ? (
        <EmptyState compact title="No activity yet" />
      ) : (
        <ol className="relative">
          {items.map((ev, i) => {
            const meta = ICON[ev.type];
            const last = i === items.length - 1;
            const body = (
              <>
                <p className="text-sm font-medium text-zinc-900">{ev.title}</p>
                {ev.description && <p className="mt-0.5 text-[0.8125rem] text-zinc-600">{ev.description}</p>}
                <p className="mt-1 text-xs text-zinc-500" title={formatDateTime(ev.createdAt)}>
                  {formatRelative(ev.createdAt)}
                </p>
              </>
            );
            return (
              <li key={ev.id} className="relative flex gap-3.5 pb-5 last:pb-0">
                {!last && <span className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-zinc-200" aria-hidden />}
                <span className={cn('relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white', meta.cls)}>
                  <meta.icon size={14} aria-hidden />
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  {ev.link ? (
                    <Link to={ev.link} className="-mx-2 -my-1 block rounded-lg px-2 py-1 transition-colors hover:bg-zinc-50">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
