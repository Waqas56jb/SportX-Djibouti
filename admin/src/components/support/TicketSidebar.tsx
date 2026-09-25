import { Link } from 'react-router-dom';
import { ArrowUpRight, Mail } from 'lucide-react';
import type { SupportTicket, TicketPriority, TicketStatus } from '@/types';
import { Avatar, DescriptionList, Panel, SkeletonText, StatusBadge } from '@/components/common';
import { Select } from '@/components/forms';
import { TICKET_CATEGORIES, labelOf } from '@/constants/catalog';
import { ORDER_STATUS, TICKET_PRIORITY, TICKET_STATUS } from '@/constants/status';
import type { SupportAssignee, TicketPatch } from '@/services/supportService';
import { customerService } from '@/services/customerService';
import { useAsync } from '@/hooks/useAsync';
import { formatDate, formatDateTime, formatMoney, formatRelative } from '@/utils/format';

const STATUS_OPTIONS = (Object.keys(TICKET_STATUS) as TicketStatus[]).map((s) => ({ value: s, label: TICKET_STATUS[s].label }));
const PRIORITY_OPTIONS = (Object.keys(TICKET_PRIORITY) as TicketPriority[]).map((p) => ({ value: p, label: TICKET_PRIORITY[p].label }));

export interface TicketSidebarProps {
  ticket: SupportTicket;
  assignees: SupportAssignee[] | undefined;
  onPatch: (patch: TicketPatch) => void;
  saving: boolean;
  canEdit: boolean;
}

function CustomerCard({ ticket: t }: { ticket: SupportTicket }) {
  const orders = useAsync(() => customerService.getCustomerOrders(t.customerId, { pageSize: 3 }), [t.customerId]);
  return (
    <Panel title="Customer" flush>
      <div className="flex items-center gap-3 px-5 py-4">
        <Avatar name={t.customerName} size={40} />
        <div className="min-w-0 flex-1">
          <Link to={`/customers/${t.customerId}`} className="block truncate text-sm font-semibold text-zinc-900 hover:underline">
            {t.customerName}
          </Link>
          <a href={`mailto:${t.customerEmail}`} className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-zinc-500 hover:text-zinc-900">
            <Mail size={12} aria-hidden /> <span className="truncate">{t.customerEmail}</span>
          </a>
        </div>
        <Link to={`/customers/${t.customerId}`} aria-label={`Open ${t.customerName}’s profile`} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
          <ArrowUpRight size={16} aria-hidden />
        </Link>
      </div>
      <div className="border-t border-zinc-100 px-5 py-3">
        <p className="eyebrow mb-2">Recent orders</p>
        {orders.loading ? (
          <SkeletonText lines={3} />
        ) : orders.error ? (
          <p className="text-[0.8125rem] text-zinc-500">Couldn’t load orders.</p>
        ) : !orders.data?.data.length ? (
          <p className="text-[0.8125rem] text-zinc-500">No orders yet.</p>
        ) : (
          <ul className="-mx-2 space-y-0.5">
            {orders.data.data.map((o) => (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className={`flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-zinc-50 ${o.number === t.orderNumber ? 'bg-volt/[0.12]' : ''}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.8125rem] font-semibold text-zinc-900 tabular">{o.number}</span>
                    <span className="block text-xs text-zinc-500">{formatDate(o.createdAt)}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-[0.8125rem] font-medium text-zinc-900 tabular">{formatMoney(o.total)}</span>
                    <StatusBadge map={ORDER_STATUS} value={o.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

/** Ticket controls (status, priority, assignee), customer context and metadata. */
export function TicketSidebar({ ticket: t, assignees, onPatch, saving, canEdit }: TicketSidebarProps) {
  const assigneeOptions = [{ value: '', label: 'Unassigned' }, ...(assignees ?? []).map((a) => ({ value: a.id, label: `${a.name} · ${a.roleName}` }))];
  // Keep the current assignee selectable even if they no longer have support access.
  if (t.assignedToId && !assigneeOptions.some((o) => o.value === t.assignedToId)) assigneeOptions.push({ value: t.assignedToId, label: t.assignedToName ?? 'Current assignee' });
  const internal = t.messages.filter((m) => m.internal).length;

  return (
    <div className="space-y-6">
      <Panel title="Ticket settings" description={saving ? 'Saving…' : canEdit ? 'Changes save instantly.' : 'You have read-only access.'}>
        <div className="space-y-4">
          <Select label="Status" value={t.status} disabled={!canEdit || saving} onChange={(e) => onPatch({ status: e.target.value as TicketStatus })} options={STATUS_OPTIONS} />
          <Select label="Priority" value={t.priority} disabled={!canEdit || saving} onChange={(e) => onPatch({ priority: e.target.value as TicketPriority })} options={PRIORITY_OPTIONS} />
          <Select label="Assigned to" value={t.assignedToId ?? ''} disabled={!canEdit || saving || !assignees} onChange={(e) => onPatch({ assignedToId: e.target.value || null })} options={assigneeOptions} />
        </div>
      </Panel>

      <CustomerCard ticket={t} />

      <Panel title="Details">
        <DescriptionList
          items={[
            { label: 'Ticket ID', value: <span className="font-medium tabular">{t.number}</span> },
            { label: 'Category', value: labelOf(TICKET_CATEGORIES, t.category) },
            {
              label: 'Linked order',
              value: t.orderNumber ? (
                <Link to={`/orders/${t.orderId ?? t.orderNumber}`} className="inline-flex items-center gap-1 font-medium text-zinc-900 hover:underline">
                  {t.orderNumber} <ArrowUpRight size={13} aria-hidden />
                </Link>
              ) : (
                <span className="text-zinc-400">None</span>
              ),
            },
            { label: 'Created', value: formatDateTime(t.createdAt) },
            { label: 'Last updated', value: <span title={formatDateTime(t.updatedAt)}>{formatRelative(t.updatedAt)}</span> },
            { label: 'Messages', value: `${t.messages.length - internal} public · ${internal} internal` },
          ]}
        />
      </Panel>
    </div>
  );
}
