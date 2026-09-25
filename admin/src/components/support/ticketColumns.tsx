import type { SupportTicket } from '@/types';
import { Avatar, StatusBadge } from '@/components/common';
import type { Column } from '@/components/tables';
import { TICKET_CATEGORIES, labelOf } from '@/constants/catalog';
import { TICKET_PRIORITY, TICKET_STATUS } from '@/constants/status';
import { formatDateTime, formatRelative } from '@/utils/format';

const PRIORITY_RANK = { urgent: 4, high: 3, normal: 2, low: 1 } as const;

/** Who wrote last: from the thread on detail views, from the list summary otherwise. Internal notes are skipped. */
export const lastAuthor = (t: SupportTicket): 'customer' | 'admin' | undefined => {
  const m = [...t.messages].reverse().find((x) => !x.internal);
  return m ? m.authorType : t.lastMessage?.author;
};

export const ticketColumns: Column<SupportTicket>[] = [
  {
    id: 'ticket',
    header: 'Ticket',
    hideable: false,
    mobile: 'title',
    cell: (t) => {
      const awaiting = lastAuthor(t) === 'customer' && t.status !== 'closed' && t.status !== 'resolved';
      return (
        <span className="flex min-w-0 max-w-[22rem] items-start gap-2">
          <span className={awaiting ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500' : 'mt-1.5 h-2 w-2 shrink-0'} aria-hidden title={awaiting ? 'Customer replied last' : undefined} />
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-zinc-500 tabular">
              {t.number} · {labelOf(TICKET_CATEGORIES, t.category)}
            </span>
            <span className="block truncate font-medium text-zinc-900">{t.subject}</span>
          </span>
        </span>
      );
    },
  },
  {
    id: 'customer',
    header: 'Customer',
    mobile: 'subtitle',
    cell: (t) => (
      <span className="block min-w-0">
        <span className="block truncate text-zinc-800">{t.customerName}</span>
        <span className="block truncate text-xs text-zinc-500">{t.customerEmail}</span>
      </span>
    ),
  },
  {
    id: 'subject',
    header: 'Subject',
    defaultHidden: true,
    mobile: 'hidden',
    cell: (t) => <span className="line-clamp-2 max-w-xs text-zinc-700">{t.subject}</span>,
  },
  { id: 'priority', header: 'Priority', mobile: 'aside', sortValue: (t) => PRIORITY_RANK[t.priority], cell: (t) => <StatusBadge map={TICKET_PRIORITY} value={t.priority} /> },
  { id: 'status', header: 'Status', mobile: 'meta', sortValue: (t) => t.status, cell: (t) => <StatusBadge map={TICKET_STATUS} value={t.status} /> },
  {
    id: 'created',
    header: 'Created',
    sortValue: (t) => t.createdAt,
    cell: (t) => (
      <span className="whitespace-nowrap text-zinc-600" title={formatDateTime(t.createdAt)}>
        {formatRelative(t.createdAt)}
      </span>
    ),
  },
  {
    id: 'updated',
    header: 'Updated',
    sortValue: (t) => t.updatedAt,
    cell: (t) => (
      <span className="whitespace-nowrap text-zinc-600" title={formatDateTime(t.updatedAt)}>
        {formatRelative(t.updatedAt)}
      </span>
    ),
  },
  {
    id: 'assigned',
    header: 'Assigned',
    cell: (t) =>
      t.assignedToName ? (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <Avatar name={t.assignedToName} size={24} />
          <span className="text-zinc-700">{t.assignedToName}</span>
        </span>
      ) : (
        <span className="inline-flex items-center rounded-md border border-dashed border-zinc-300 px-1.5 py-0.5 text-xs font-medium text-zinc-500">Unassigned</span>
      ),
  },
];
