import { AlertTriangle, CreditCard, RotateCcw, ShieldCheck } from 'lucide-react';
import type { Order } from '@/types';
import { PAYMENT_METHOD, PAYMENT_STATUS } from '@/constants/status';
import { formatDateTime, formatMoney } from '@/utils/format';
import { Button, Can, DescriptionList, Panel, StatusBadge } from '@/components/common';
import { REFUND_REASONS, labelOf } from '@/constants/catalog';
import { canRefund } from './orderMeta';

/** Non-sensitive payment record. Only brand + last 4 digits are ever shown. */
export function OrderPaymentPanel({ order, onRefund }: { order: Order; onRefund: () => void }) {
  const p = order.payment;
  return (
    <Panel
      title="Payment"
      actions={<StatusBadge map={PAYMENT_STATUS} value={p.status} size="md" />}
      footer={
        <p className="flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
          <ShieldCheck size={14} className="mt-px shrink-0 text-emerald-600" aria-hidden />
          Card data is tokenised by the payment provider. SPORTX never stores or displays full card numbers or CVV.
        </p>
      }
    >
      <DescriptionList
        columns={2}
        items={[
          { label: 'Method', value: PAYMENT_METHOD[p.method] },
          { label: 'Provider', value: p.provider },
          { label: 'Amount', value: <span className="font-semibold tabular">{formatMoney(p.amount)}</span> },
          { label: 'Refunded', value: <span className={p.refundedAmount ? 'font-medium text-red-600 tabular' : 'tabular text-zinc-500'}>{formatMoney(p.refundedAmount)}</span> },
          {
            label: 'Card',
            hidden: !p.cardLast4,
            value: (
              <span className="inline-flex items-center gap-1.5">
                <CreditCard size={14} className="text-zinc-400" aria-hidden /> {p.cardBrand ?? 'Card'} <span className="font-mono tracking-wider">•••• {p.cardLast4}</span>
              </span>
            ),
          },
          { label: 'Paid at', value: p.paidAt ? formatDateTime(p.paidAt) : 'Not yet paid' },
          { label: 'Transaction ref.', value: <span className="break-all font-mono text-xs">{p.transactionRef || '—'}</span> },
        ]}
      />
      {p.failureReason && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[0.8125rem] text-red-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Payment failed:</strong> {p.failureReason}
          </span>
        </div>
      )}
      {order.refunds.length > 0 && (
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <p className="eyebrow mb-2">Refunds</p>
          <ul className="space-y-2">
            {order.refunds.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-medium text-zinc-900">{labelOf(REFUND_REASONS, r.reason)}</p>
                  <p className="text-xs text-zinc-500">
                    {formatDateTime(r.createdAt)} · {r.requestedBy}
                  </p>
                </div>
                <span className="whitespace-nowrap text-[0.8125rem] font-semibold text-red-600 tabular">−{formatMoney(r.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {canRefund(order) && (
        <Can permission="orders:approve">
          <Button variant="secondary" size="sm" icon={RotateCcw} className="mt-4 print:hidden" onClick={onRefund}>
            Issue refund
          </Button>
        </Can>
      )}
    </Panel>
  );
}
