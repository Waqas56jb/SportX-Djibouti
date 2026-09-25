import { Bell, BellOff, CheckCheck, ChevronRight, CreditCard, LifeBuoy, Mail, MailOpen, Package, RotateCcw, Trash2, Truck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AccountSection } from '@/components/account/AccountLayout';
import { Button, EmptyState, ErrorState, SkeletonLoader } from '@/components/common';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { friendlyError } from '@/services/authService';
import { notificationService } from '@/services/notificationService';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import type { AppNotification, NotificationPage } from '@/types';
import { cn } from '@/utils/cn';
import { formatDateTime, formatRelative } from '@/utils/format';

const PAGE_SIZE = 20;

const ICONS: Record<string, typeof Bell> = {
  ORDER_CREATED: Package,
  PAYMENT_CONFIRMED: CreditCard,
  ORDER_PROCESSING: Package,
  ORDER_SHIPPED: Truck,
  ORDER_DELIVERED: Package,
  ORDER_CANCELLED: XCircle,
  REFUND_PROCESSED: RotateCcw,
  SUPPORT_REPLY: LifeBuoy,
};

/** Only follow in-app links; anything else is ignored. */
const safeLink = (link: string | null) => (link && link.startsWith('/') && !link.startsWith('//') ? link : null);

export default function NotificationsPage() {
  usePageMeta({ title: 'Notifications', noindex: true });
  const setUnread = useAuthStore((s) => s.setUnread);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, loading, error, reload, setData } = useAsync(
    async () => {
      const res = await notificationService.list({ page, limit: PAGE_SIZE, unread: unreadOnly });
      setUnread(res.unreadCount);
      return res;
    },
    [page, unreadOnly],
    { keepPrevious: true },
  );

  const patch = (fn: (items: AppNotification[]) => AppNotification[], unreadCount: number) => {
    setUnread(unreadCount);
    setData((prev) => ({ ...(prev as NotificationPage), items: fn(prev?.items ?? []), unreadCount }));
  };

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
    } catch (err) {
      toast.error('Could not update notifications', { description: friendlyError(err) });
    } finally {
      setBusy(null);
    }
  };

  const toggleRead = (n: AppNotification) =>
    run(n.id, async () => {
      const res = n.read ? await notificationService.markUnread(n.id) : await notificationService.markRead(n.id);
      patch((items) => (unreadOnly && res.notification.read ? items.filter((i) => i.id !== n.id) : items.map((i) => (i.id === n.id ? res.notification : i))), res.unreadCount);
    });

  const remove = (n: AppNotification) =>
    run(n.id, async () => {
      const res = await notificationService.remove(n.id);
      patch((items) => items.filter((i) => i.id !== n.id), res.unreadCount);
      if (data && data.items.length === 1 && page > 1) setPage((p) => p - 1);
    });

  const markAll = () =>
    run('all', async () => {
      await notificationService.markAllRead();
      if (unreadOnly) {
        patch(() => [], 0);
      } else {
        const now = new Date().toISOString();
        patch((items) => items.map((i) => (i.read ? i : { ...i, read: true, readAt: now })), 0);
      }
      toast.success('All notifications marked as read');
    });

  /** Opening a notification marks it read (fire-and-forget). */
  const open = (n: AppNotification) => {
    if (n.read) return;
    notificationService
      .markRead(n.id)
      .then((res) => setUnread(res.unreadCount))
      .catch(() => undefined);
  };

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <AccountSection
      title="Notifications"
      description="Order, delivery and support updates for your account."
      action={
        <Button variant="outline" size="sm" onClick={markAll} disabled={unread === 0} loading={busy === 'all'} leftIcon={<CheckCheck className="h-4 w-4" />}>
          Mark all as read
        </Button>
      }
    >
      <div className="mb-6 flex gap-2" role="tablist" aria-label="Filter notifications">
        {[
          { key: false, label: 'All' },
          { key: true, label: 'Unread', count: unread },
        ].map((f) => (
          <button
            key={f.label}
            type="button"
            role="tab"
            aria-selected={unreadOnly === f.key}
            onClick={() => {
              setUnreadOnly(f.key);
              setPage(1);
            }}
            className={cn(
              'min-h-[40px] shrink-0 rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.1em] transition-colors',
              unreadOnly === f.key ? 'border-ink bg-ink text-white' : 'border-paper-300 bg-white hover:border-ink',
            )}
          >
            {f.label}
            {f.count !== undefined && data && <span className="ml-1.5 opacity-60">{f.count}</span>}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <SkeletonLoader rows={4} />
      ) : items.length === 0 ? (
        <div className="border border-paper-200 bg-white">
          <EmptyState
            compact
            icon={unreadOnly ? <CheckCheck /> : <BellOff />}
            title={unreadOnly ? 'You’re all caught up' : 'No notifications yet'}
            description={unreadOnly ? 'There are no unread notifications.' : 'Updates about your orders and support requests will appear here.'}
          />
        </div>
      ) : (
        <>
          <ul className={cn('divide-y divide-paper-200 border border-paper-200 bg-white transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
            {items.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              const link = safeLink(n.link);
              const body = (
                <>
                  <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', n.read ? 'bg-paper-100 text-ink-500' : 'bg-ink text-white')}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                      <span className={cn('truncate text-[15px]', n.read ? 'font-medium text-ink-700' : 'font-semibold text-ink')}>{n.title}</span>
                    </span>
                    <span className="mt-1 block text-sm text-ink-600">{n.message}</span>
                    <time className="mt-1.5 block text-xs text-ink-500" dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>
                      {formatRelative(n.createdAt)}
                    </time>
                  </span>
                  {link && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-ink-500" aria-hidden />}
                </>
              );
              return (
                <li key={n.id} className={cn('flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5', !n.read && 'bg-paper-50')}>
                  {link ? (
                    <Link to={link} onClick={() => open(n)} className="flex min-w-0 flex-1 gap-4 hover:opacity-80">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 gap-4">{body}</div>
                  )}
                  <div className="flex shrink-0 gap-1 self-end sm:self-start">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === n.id}
                      onClick={() => toggleRead(n)}
                      aria-label={n.read ? `Mark “${n.title}” as unread` : `Mark “${n.title}” as read`}
                      leftIcon={n.read ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />}
                    >
                      <span className="hidden sm:inline">{n.read ? 'Unread' : 'Read'}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === n.id}
                      onClick={() => remove(n)}
                      aria-label={`Delete “${n.title}”`}
                      className="hover:text-danger"
                      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    >
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {data && data.totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between gap-4" aria-label="Notification pages">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <p className="text-xs text-ink-500">
                Page {data.page} of {data.totalPages}
              </p>
              <Button variant="outline" size="sm" disabled={!data.hasNext || loading} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </AccountSection>
  );
}
