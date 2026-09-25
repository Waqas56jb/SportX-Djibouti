import { useState } from 'react';
import { Ban, Check, CreditCard, MessageSquare, PackageCheck, RotateCcw, ShoppingBag, Timer, Truck, Waypoints, XCircle, type LucideIcon } from 'lucide-react';
import type { Order, OrderTimelineEvent, TimelineEventKind } from '@/types';
import { orderService } from '@/services/orderService';
import { formatDateTime, formatRelative } from '@/utils/format';
import { cn } from '@/utils/cn';
import { toast } from '@/store/toastStore';
import { usePermission } from '@/hooks/usePermission';
import { Badge, Button, Panel } from '@/components/common';
import { Textarea } from '@/components/forms';
import { cloneOrder } from './useOrderActions';

const KIND_ICON: Record<TimelineEventKind, { icon: LucideIcon; cls: string }> = {
  created: { icon: ShoppingBag, cls: 'bg-zinc-100 text-zinc-700' },
  payment_confirmed: { icon: CreditCard, cls: 'bg-emerald-50 text-emerald-600' },
  payment_failed: { icon: XCircle, cls: 'bg-red-50 text-red-600' },
  pending: { icon: Timer, cls: 'bg-amber-50 text-amber-600' },
  processing: { icon: Timer, cls: 'bg-sky-50 text-sky-600' },
  packed: { icon: PackageCheck, cls: 'bg-sky-50 text-sky-600' },
  shipped: { icon: Truck, cls: 'bg-ink-950 text-volt' },
  out_for_delivery: { icon: Truck, cls: 'bg-ink-950 text-volt' },
  delivered: { icon: Check, cls: 'bg-emerald-50 text-emerald-600' },
  cancelled: { icon: Ban, cls: 'bg-zinc-100 text-zinc-500' },
  refunded: { icon: RotateCcw, cls: 'bg-red-50 text-red-600' },
  note: { icon: MessageSquare, cls: 'bg-amber-50 text-amber-700' },
  tracking_added: { icon: Waypoints, cls: 'bg-sky-50 text-sky-600' },
  refund_requested: { icon: RotateCcw, cls: 'bg-amber-50 text-amber-600' },
  refund_completed: { icon: RotateCcw, cls: 'bg-red-50 text-red-600' },
};

const ACTOR_TONE: Record<OrderTimelineEvent['actorType'], 'neutral' | 'muted' | 'info'> = { admin: 'neutral', system: 'muted', customer: 'info' };

/** Complete activity feed (status changes, payments, tracking, refunds, notes) + internal note composer. */
export function OrderActivityPanel({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const canEdit = usePermission('orders:edit');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const events = [...order.timeline].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const addNote = async () => {
    const text = note.trim();
    if (!text) return;
    setSaving(true);
    try {
      onChange(cloneOrder(await orderService.addNote(order.id, text)));
      setNote('');
      toast.success('Note added.');
    } catch (e) {
      toast.error('Note not saved.', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Activity" description={`${events.length} event${events.length === 1 ? '' : 's'} · newest first`}>
      {canEdit && (
        <div className="mb-6 print:hidden">
          <Textarea
            label="Internal note"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Only visible to admins — e.g. “Customer asked to deliver after 5pm.”"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void addNote();
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-400">Ctrl + Enter to save</span>
            <Button size="sm" variant="secondary" icon={MessageSquare} loading={saving} disabled={!note.trim()} onClick={() => void addNote()}>
              Add note
            </Button>
          </div>
        </div>
      )}

      <ol className="relative space-y-5">
        {events.map((e, i) => {
          const meta = KIND_ICON[e.kind] ?? KIND_ICON.note;
          return (
            <li key={e.id} className="relative flex gap-3">
              {i < events.length - 1 && <span className="absolute -bottom-5 left-[15px] top-9 w-px bg-zinc-200" aria-hidden />}
              <span className={cn('relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white', meta.cls)}>
                <meta.icon size={14} aria-hidden />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="text-[0.8125rem] font-semibold text-zinc-900">{e.title}</p>
                  <time dateTime={e.createdAt} title={formatDateTime(e.createdAt)} className="text-xs text-zinc-500 tabular">
                    {formatDateTime(e.createdAt)}
                  </time>
                </div>
                {e.description && <p className={cn('mt-1 text-[0.8125rem] leading-relaxed text-zinc-600', e.kind === 'note' && 'rounded-lg bg-amber-50/60 px-3 py-2 text-zinc-800')}>{e.description}</p>}
                <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                  {e.actor}
                  <Badge tone={ACTOR_TONE[e.actorType]}>{e.actorType.charAt(0).toUpperCase() + e.actorType.slice(1)}</Badge>
                  <span className="text-zinc-300">·</span>
                  {formatRelative(e.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
