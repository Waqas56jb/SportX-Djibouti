import { useEffect, useState } from 'react';
import { Check, CircleSlash, RotateCcw } from 'lucide-react';
import type { Order, OrderStatus, OrderTimelineEvent, TimelineEventKind } from '@/types';
import { ORDER_FLOW, ORDER_STATUS } from '@/constants/status';
import { formatDateTime, formatShortDate, formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { usePermission } from '@/hooks/usePermission';
import { Button, Panel } from '@/components/common';
import { Select, Textarea } from '@/components/forms';
import { nextStatuses } from './orderMeta';

const STEPS: { key: TimelineEventKind; label: string }[] = [
  { key: 'created', label: 'Order Created' },
  { key: 'payment_confirmed', label: 'Payment Confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

const ACTOR_LABEL: Record<OrderTimelineEvent['actorType'], string> = { admin: 'Admin', system: 'System', customer: 'Customer' };

function lastEvent(o: Order, kind: TimelineEventKind) {
  return [...o.timeline].reverse().find((e) => e.kind === kind);
}

function computeSteps(o: Order) {
  const flowIdx = (k: string) => ORDER_FLOW.indexOf(k as OrderStatus);
  const reached = Math.max(flowIdx(o.status), ...o.timeline.map((e) => flowIdx(e.kind)));
  const paid = ['paid', 'partially_refunded', 'refunded', 'authorized'].includes(o.payment.status);
  // Cash on delivery is collected at the door — the payment step is tracked in the payment panel instead.
  const steps = o.payment.method === 'cash_on_delivery' ? STEPS.filter((s) => s.key !== 'payment_confirmed') : STEPS;
  return steps.map((s) => {
    const ev = s.key === 'created' ? (lastEvent(o, 'created') ?? { createdAt: o.createdAt, actor: o.customerName, actorType: 'customer' as const }) : lastEvent(o, s.key);
    const done = s.key === 'created' || (s.key === 'payment_confirmed' ? Boolean(ev) || paid : flowIdx(s.key) <= reached);
    return { ...s, done, ev };
  });
}

/** Fulfilment stepper + "Update status" control (only the server's allowed transitions are offered). */
export function OrderProgressPanel({ order, onStatus, busy }: { order: Order; onStatus: (s: OrderStatus, note?: string) => Promise<boolean>; busy?: boolean }) {
  const canEdit = usePermission('orders:edit');
  const steps = computeSteps(order);
  const current = steps.findIndex((s) => !s.done);
  const closed = order.status === 'cancelled' || order.status === 'refunded';
  const terminal = closed ? (lastEvent(order, order.status) ?? lastEvent(order, 'refund_completed')) : undefined;
  const options = nextStatuses(order);
  const [target, setTarget] = useState<OrderStatus | ''>(options[0] ?? '');
  const [note, setNote] = useState('');

  useEffect(() => {
    setTarget(nextStatuses(order)[0] ?? '');
  }, [order.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!target) return;
    if (await onStatus(target, note.trim() || undefined)) setNote('');
  };

  return (
    <Panel title="Fulfilment progress" description={`Current status: ${ORDER_STATUS[order.status].label}`}>
      {closed ? (
        <div className={cn('mb-5 flex items-start gap-3 rounded-lg border px-3.5 py-3', order.status === 'cancelled' ? 'border-zinc-200 bg-zinc-50' : 'border-red-200 bg-red-50/70')}>
          {order.status === 'cancelled' ? <CircleSlash size={17} className="mt-0.5 shrink-0 text-zinc-500" aria-hidden /> : <RotateCcw size={17} className="mt-0.5 shrink-0 text-red-600" aria-hidden />}
          <div className="text-[0.8125rem]">
            <p className="font-semibold text-zinc-900">Order {ORDER_STATUS[order.status].label.toLowerCase()}</p>
            {terminal && (
              <p className="text-zinc-600">
                {formatDateTime(terminal.createdAt)} · {terminal.actor}
                {terminal.description ? ` — ${terminal.description}` : ''}
              </p>
            )}
          </div>
        </div>
      ) : null}

      <ol className={cn('relative grid gap-0 md:gap-2', steps.length === 7 ? 'md:grid-cols-7' : 'md:grid-cols-6')} aria-label="Order progress">
        {steps.map((s, i) => {
          const isCurrent = i === current && !closed;
          const nextDone = steps[i + 1]?.done;
          return (
            <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0 md:flex-col md:gap-2 md:pb-0" aria-current={isCurrent ? 'step' : undefined}>
              {i < steps.length - 1 && (
                <>
                  <span className={cn('absolute bottom-0 left-[13px] top-7 w-0.5 md:hidden', nextDone ? 'bg-ink-950' : 'bg-zinc-200')} aria-hidden />
                  <span className={cn('absolute left-8 right-[-0.5rem] top-[13px] hidden h-0.5 md:block', nextDone ? 'bg-ink-950' : 'bg-zinc-200')} aria-hidden />
                </>
              )}
              <span
                className={cn(
                  'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-white',
                  s.done ? 'bg-ink-950 text-volt' : isCurrent ? 'border-2 border-ink-950 bg-white text-ink-950' : 'border-2 border-zinc-200 bg-white text-zinc-400',
                )}
              >
                {s.done ? <Check size={14} strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className={cn('text-[0.8125rem] font-semibold leading-tight', s.done || isCurrent ? 'text-zinc-950' : 'text-zinc-400')}>{s.label}</p>
                {s.done && s.ev ? (
                  <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                    <span className="tabular">
                      {formatShortDate(s.ev.createdAt)}, {formatTime(s.ev.createdAt)}
                    </span>
                    <span className="block truncate" title={`${s.ev.actor} (${ACTOR_LABEL[s.ev.actorType]})`}>
                      {s.ev.actor}
                    </span>
                  </p>
                ) : s.done ? (
                  <p className="mt-0.5 text-xs text-zinc-400">Completed</p>
                ) : isCurrent ? (
                  <p className="mt-0.5 text-xs font-medium text-zinc-600">Next step</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {canEdit && options.length > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 print:hidden">
          <p className="mb-3 text-[0.8125rem] font-semibold text-zinc-900">Update status</p>
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <Select label="New status" size="sm" value={target} onChange={(e) => setTarget(e.target.value as OrderStatus)} options={options.map((s) => ({ value: s, label: ORDER_STATUS[s].label }))} />
            <Textarea label="Note" optional rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Added to the order timeline" />
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="primary" size="sm" loading={busy} disabled={!target} onClick={() => void submit()}>
              {target ? `Mark as ${ORDER_STATUS[target].label}` : 'Update status'}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
