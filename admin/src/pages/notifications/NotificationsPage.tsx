import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BellOff, CheckCheck, ChevronRight, Mail, MailOpen, Settings2, Trash2 } from 'lucide-react';
import type { AdminNotification, NotificationType } from '@/types';
import { Button, EmptyState, ErrorState, Menu, PageHeader, Skeleton, Tabs } from '@/components/common';
import { Checkbox, FilterSelect } from '@/components/forms';
import { NOTIFICATION_ICON } from '@/components/navigation/Topbar';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useNotificationStore } from '@/store/notificationStore';
import { notificationService } from '@/services/notificationService';
import { useAsync } from '@/hooks/useAsync';
import { Pagination } from '@/components/tables';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';
import { formatDateTime, formatRelative } from '@/utils/format';

const TYPE_LABEL: Record<NotificationType, string> = {
  low_stock: 'Low stock',
  new_order: 'New order',
  payment_failed: 'Payment failed',
  refund_requested: 'Refund requested',
  new_ticket: 'New ticket',
  new_customer: 'New customer',
  review_pending: 'Review pending',
};
const TYPE_OPTIONS = (Object.keys(TYPE_LABEL) as NotificationType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] }));

const plural = (n: number) => `${n} notification${n === 1 ? '' : 's'}`;
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

function NotificationRow({ n, selected, onSelect, onOpen, onRead, onDelete }: { n: AdminNotification; selected: boolean; onSelect: (on: boolean) => void; onOpen: () => void; onRead: (read: boolean) => void; onDelete: () => void }) {
  const meta = NOTIFICATION_ICON[n.type] ?? { icon: Bell, cls: 'bg-zinc-100 text-zinc-600' };
  return (
    <li className={cn('group flex items-start gap-3 px-4 py-3.5 transition-colors sm:px-5', selected ? 'bg-volt/[0.08]' : n.read ? 'hover:bg-zinc-50' : 'bg-volt/[0.04] hover:bg-volt/[0.08]')}>
      <Checkbox className="mt-2.5" ariaLabel={`Select “${n.title}”`} checked={selected} onChange={onSelect} />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', meta.cls)}>
          <meta.icon size={17} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn('truncate text-sm', n.read ? 'font-medium text-zinc-700' : 'font-semibold text-zinc-950')}>{n.title}</span>
            {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label="Unread" />}
          </span>
          <span className={cn('mt-0.5 block text-[0.8125rem] leading-snug', n.read ? 'text-zinc-500' : 'text-zinc-700')}>{n.message}</span>
          <span className="mt-1.5 flex items-center gap-2 text-xs text-zinc-500">
            <span className="rounded bg-zinc-100 px-1.5 py-px font-medium text-zinc-600">{TYPE_LABEL[n.type] ?? n.type}</span>
            <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>
              {formatRelative(n.createdAt)}
            </time>
          </span>
        </span>
        {n.link && <ChevronRight size={16} className="mt-2.5 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" aria-hidden />}
      </button>
      <Menu
        label={`Actions for “${n.title}”`}
        items={[
          n.read ? { label: 'Mark as unread', icon: Mail, onSelect: () => onRead(false) } : { label: 'Mark as read', icon: MailOpen, onSelect: () => onRead(true) },
          { label: 'Delete', icon: Trash2, onSelect: onDelete, danger: true, separator: true },
        ]}
      />
    </li>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { unreadCount, setRead, markAllRead, remove } = useNotificationStore();
  const { filters, setFilter: setUrlFilter, setFilters, resetFilters } = useUrlFilters({ view: 'all', type: '', page: '' });
  const setFilter = (k: 'view' | 'type', v: string) => setFilters({ [k]: v, page: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(20);

  const view = filters.view === 'unread' ? 'unread' : 'all';
  const page = Math.max(1, Number(filters.page) || 1);
  const list = useAsync(() => notificationService.list({ page, pageSize, unread: view === 'unread', type: (filters.type as NotificationType) || '' }), [page, pageSize, view, filters.type]);
  const { error } = list;
  const loaded = Boolean(list.data);
  const total = list.data?.total ?? 0;
  const items = useMemo(() => list.data?.data ?? [], [list.data]);
  const patchRows = (fn: (rows: AdminNotification[]) => AdminNotification[]) => list.setData((prev) => (prev ? { ...prev, data: fn(prev.data) } : prev));
  const load = () => list.reload();
  // In the Unread view, rows that become read drop out — refetch so the page stays full.
  const refetchIfFiltered = () => {
    if (view === 'unread') void list.reload(true);
  };
  const visible = items;
  const groups = useMemo(
    () =>
      [
        { label: 'Today', rows: visible.filter((n) => isToday(n.createdAt)) },
        { label: 'Earlier', rows: visible.filter((n) => !isToday(n.createdAt)) },
      ].filter((g) => g.rows.length),
    [visible],
  );

  // Drop selections that are no longer visible.
  useEffect(() => {
    const ids = new Set(visible.map((n) => n.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visible]);

  const selectedIds = [...selected];
  const allSelected = visible.length > 0 && visible.every((n) => selected.has(n.id));
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const doRead = async (ids: string[], read: boolean, announce = true) => {
    try {
      await setRead(ids, read);
      patchRows((rows) => rows.map((n) => (ids.includes(n.id) ? { ...n, read } : n)));
      refetchIfFiltered();
      if (announce) toast.success(`${plural(ids.length)} marked as ${read ? 'read' : 'unread'}.`);
      setSelected(new Set());
    } catch {
      toast.error('Could not update notifications. Please try again.');
    }
  };
  const doRemove = async (ids: string[]) => {
    if (ids.length > 1 && !(await confirm({ title: `Delete ${plural(ids.length)}?`, description: 'Deleted notifications can’t be restored.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await remove(ids);
      if (ids.length >= items.length && page > 1) setUrlFilter('page', String(page - 1));
      else void list.reload(true);
      toast.success(`${ids.length === 1 ? 'Notification' : plural(ids.length)} deleted.`);
      setSelected(new Set());
    } catch {
      toast.error('Could not delete notifications.');
      void load();
    }
  };
  const doMarkAll = async () => {
    try {
      await markAllRead();
      patchRows((rows) => rows.map((n) => ({ ...n, read: true })));
      refetchIfFiltered();
      toast.success('All notifications marked as read.');
    } catch {
      toast.error('Could not mark notifications as read.');
      void load();
    }
  };
  const open = (n: AdminNotification) => {
    if (!n.read) void setRead([n.id], true).then(() => patchRows((rows) => rows.map((x) => (x.id === n.id ? { ...x, read: true } : x)))).catch(() => undefined);
    if (n.link) navigate(n.link);
  };

  const filtered = view === 'unread' || Boolean(filters.type);
  const empty = view === 'unread' && !filters.type
    ? { title: 'You’re all caught up', description: 'No unread notifications. New alerts will appear here.' }
    : filters.type
      ? { title: `No ${TYPE_LABEL[filters.type as NotificationType]?.toLowerCase() ?? ''} notifications`, description: view === 'unread' ? 'Nothing unread of this type.' : 'Nothing of this type yet.' }
      : { title: 'No notifications', description: 'Store alerts such as new orders, low stock and support tickets will appear here.' };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Notifications"
        description={loaded ? (unreadCount ? `You have ${plural(unreadCount)} unread.` : 'You’re all caught up.') : 'Store alerts and activity that need your attention.'}
        actions={
          <>
            <Button icon={Settings2} onClick={() => navigate('/settings/notifications')}>
              Preferences
            </Button>
            <Button variant="primary" icon={CheckCheck} onClick={() => void doMarkAll()} disabled={!unreadCount}>
              Mark all read
            </Button>
          </>
        }
      />

      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 pt-3 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <Tabs
            ariaLabel="Notification filter"
            value={view}
            onChange={(v) => setFilter('view', v)}
            items={[
              { value: 'all', label: 'All', count: view === 'all' && !filters.type && loaded ? total : undefined },
              { value: 'unread', label: 'Unread', count: unreadCount },
            ]}
          />
          <div className="pb-3">
            <FilterSelect label="Type" value={filters.type} onChange={(v) => setFilter('type', v)} options={TYPE_OPTIONS} />
          </div>
        </div>

        {visible.length > 0 && (
          <div className={cn('flex min-h-[48px] flex-wrap items-center gap-3 border-b px-4 py-2 sm:px-5', selected.size ? 'border-zinc-800 bg-ink-950 text-white' : 'border-zinc-100 bg-zinc-50/70')}>
            <Checkbox
              ariaLabel="Select all visible notifications"
              checked={allSelected}
              indeterminate={selected.size > 0}
              onChange={(on) => setSelected(on ? new Set(visible.map((n) => n.id)) : new Set())}
              label={<span className={cn('text-[0.8125rem] font-medium', selected.size ? 'text-white' : 'text-zinc-600')}>{selected.size ? `${selected.size} selected` : 'Select all'}</span>}
            />
            {selected.size > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {[
                  { label: 'Mark read', icon: MailOpen, run: () => void doRead(selectedIds, true) },
                  { label: 'Mark unread', icon: Mail, run: () => void doRead(selectedIds, false) },
                  { label: 'Delete', icon: Trash2, run: () => void doRemove(selectedIds), danger: true },
                ].map((a) => (
                  <button key={a.label} type="button" onClick={a.run} className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[0.8125rem] font-medium transition-colors', a.danger ? 'text-red-300 hover:bg-red-500/15' : 'text-zinc-200 hover:bg-white/10')}>
                    <a.icon size={14} aria-hidden /> {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && !loaded ? (
          <ErrorState description="We couldn’t load your notifications." onRetry={() => void load()} />
        ) : !loaded ? (
          <ul aria-busy="true" aria-label="Loading notifications">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 last:border-0">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </li>
            ))}
          </ul>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={empty.title}
            description={empty.description}
            action={
              filtered ? (
                <Button size="sm" onClick={resetFilters}>
                  Show all notifications
                </Button>
              ) : undefined
            }
          />
        ) : (
          groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-2 text-2xs font-semibold uppercase tracking-wider text-zinc-500">
                {g.label} <span className="ml-1 text-zinc-400 tabular">{g.rows.length}</span>
              </h2>
              <ul className="divide-y divide-zinc-100">
                {g.rows.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    selected={selected.has(n.id)}
                    onSelect={(on) => toggle(n.id, on)}
                    onOpen={() => open(n)}
                    onRead={(read) => void doRead([n.id], read, false)}
                    onDelete={() => void doRemove([n.id])}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
        {loaded && total > 0 && (
          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(total / pageSize))}
            pageSize={pageSize}
            total={total}
            sizes={[10, 20, 50]}
            onPageChange={(p) => setUrlFilter('page', p <= 1 ? '' : String(p))}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setUrlFilter('page', '');
            }}
          />
        )}
      </div>
    </div>
  );
}
