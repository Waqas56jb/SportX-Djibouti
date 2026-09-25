import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, LifeBuoy, Package, RotateCcw, User } from 'lucide-react';
import type { SupportTicket } from '@/types';
import { Badge, Button, EmptyState, ErrorState, PageHeader, PageSkeleton, Panel, StatusBadge } from '@/components/common';
import { TicketComposer, type ComposerMode } from '@/components/support/TicketComposer';
import { TicketSidebar } from '@/components/support/TicketSidebar';
import { TicketThread } from '@/components/support/TicketThread';
import { TICKET_CATEGORIES, labelOf } from '@/constants/catalog';
import { TICKET_PRIORITY, TICKET_STATUS } from '@/constants/status';
import { supportService, type TicketPatch } from '@/services/supportService';
import { useAsync } from '@/hooks/useAsync';
import { usePermission } from '@/hooks/usePermission';
import { useNotificationStore } from '@/store/notificationStore';
import { toast } from '@/store/toastStore';

const isNotFound = (e: Error | null) => Boolean(e && ((e as Error & { status?: number }).status === 404 || /not found/i.test(e.message)));

function patchMessage(before: SupportTicket, after: SupportTicket, patch: TicketPatch): string {
  if (patch.status) return `Status changed to ${TICKET_STATUS[after.status].label}.`;
  if (patch.priority) return `Priority set to ${TICKET_PRIORITY[after.priority].label}.`;
  if (patch.assignedToId !== undefined) return after.assignedToName ? `Ticket assigned to ${after.assignedToName}.` : 'Ticket unassigned.';
  return before.number;
}

export default function TicketDetailPage() {
  const { id = '' } = useParams();
  const { data: t, loading, error, reload, setData } = useAsync(() => supportService.getTicket(id), [id]);
  const assignees = useAsync(() => supportService.getAssignees(), []);
  const refreshCounts = useNotificationStore((s) => s.refreshCounts);
  const canEdit = usePermission('support:edit');
  const [saving, setSaving] = useState(false);

  if (loading && !t) return <PageSkeleton />;

  if (isNotFound(error)) {
    return (
      <div className="panel">
        <EmptyState
          icon={LifeBuoy}
          title="Ticket not found"
          description="This ticket may have been removed, or the link is incorrect."
          action={
            <Link to="/support" className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink-950 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-ink-800">
              <ArrowLeft size={16} aria-hidden /> Back to support
            </Link>
          }
        />
      </div>
    );
  }
  if (error || !t) {
    return (
      <div className="panel">
        <ErrorState description="We couldn’t load this ticket. Please try again." onRetry={() => void reload()} />
      </div>
    );
  }

  const patch = async (p: TicketPatch) => {
    setSaving(true);
    try {
      const next = await supportService.updateTicket(t.id, p);
      setData(next);
      toast.success(patchMessage(t, next, p), { description: `${next.number} · ${next.subject}` });
      if (p.status) void refreshCounts();
    } catch (e) {
      toast.error('Could not update ticket', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const send = async (body: string, mode: ComposerMode): Promise<boolean> => {
    try {
      const next = await supportService.replyToTicket(t.id, body, mode === 'note');
      setData(next);
      if (mode === 'note') toast.success('Internal note added.', { description: 'Visible to your team only.' });
      else toast.success('Reply sent to customer.', { description: next.status !== t.status ? `Status set to ${TICKET_STATUS[next.status].label}.` : `Emailed to ${next.customerEmail}.` });
      void refreshCounts();
      return true;
    } catch (e) {
      toast.error(mode === 'note' ? 'Could not add note' : 'Could not send reply', { description: e instanceof Error ? e.message : undefined });
      return false;
    }
  };

  const done = t.status === 'resolved' || t.status === 'closed';
  const firstName = t.customerName.split(' ')[0] || t.customerName;

  return (
    <div>
      <PageHeader
        backTo="/support"
        backLabel="Support"
        eyebrow={<span className="tabular">{t.number}</span>}
        documentTitle={`${t.number} · ${t.subject}`}
        title={t.subject}
        meta={
          <>
            <StatusBadge map={TICKET_STATUS} value={t.status} size="md" />
            <StatusBadge map={TICKET_PRIORITY} value={t.priority} size="md" />
            <Badge size="md" tone="neutral">
              {labelOf(TICKET_CATEGORIES, t.category)}
            </Badge>
            <Link to={`/customers/${t.customerId}`} className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-zinc-600 hover:text-zinc-950 hover:underline">
              <User size={14} aria-hidden /> {t.customerName}
            </Link>
            {t.orderNumber && (
              <Link to={`/orders/${t.orderId ?? t.orderNumber}`} className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-zinc-600 tabular hover:text-zinc-950 hover:underline">
                <Package size={14} aria-hidden /> Order {t.orderNumber}
              </Link>
            )}
          </>
        }
        actions={
          canEdit ? (
            done ? (
              <Button icon={RotateCcw} onClick={() => void patch({ status: 'open' })} disabled={saving}>
                Reopen ticket
              </Button>
            ) : (
              <Button variant="primary" icon={CheckCircle2} onClick={() => void patch({ status: 'resolved' })} disabled={saving}>
                Mark as resolved
              </Button>
            )
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="min-w-0 overflow-hidden lg:col-span-2" title="Conversation" description={`${t.messages.length} ${t.messages.length === 1 ? 'message' : 'messages'}`} flush>
          <TicketThread messages={t.messages} />
          {canEdit ? (
            <TicketComposer customerFirstName={firstName} onSend={send} closed={t.status === 'closed'} />
          ) : (
            <p className="border-t border-zinc-100 px-5 py-4 text-[0.8125rem] text-zinc-500">You have read-only access to this ticket.</p>
          )}
        </Panel>
        <div className="min-w-0">
          <TicketSidebar ticket={t} assignees={assignees.data} onPatch={(p) => void patch(p)} saving={saving} canEdit={canEdit} />
        </div>
      </div>
    </div>
  );
}
