import { useEffect, useState } from 'react';
import { AlertCircle, Info } from 'lucide-react';
import type { Order, RefundReason } from '@/types';
import { orderService } from '@/services/orderService';
import { REFUND_REASONS } from '@/constants/catalog';
import { PAYMENT_METHOD, PAYMENT_STATUS } from '@/constants/status';
import { formatMoney } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { Button, StatusBadge } from '@/components/common';
import { CurrencyInput, RadioGroup, Select, Textarea, Toggle } from '@/components/forms';
import { Modal } from '@/components/modals/Overlay';
import { refundable } from './orderMeta';
import { cloneOrder, refreshBadges } from './useOrderActions';

/** Records a full or partial refund. Frontend phase: no money moves — the backend will call the provider. */
export function RefundModal({ open, order, onClose, onDone }: { open: boolean; order: Order; onClose: () => void; onDone: (o: Order) => void }) {
  const remaining = refundable(order);
  const [type, setType] = useState<'full' | 'partial'>('full');
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState<RefundReason>('customer_request');
  const [note, setNote] = useState('');
  const [restock, setRestock] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType('full');
    setAmount('');
    setReason('customer_request');
    setNote('');
    setRestock(false);
    setSubmitted(false);
    setServerError(null);
  }, [open]);

  const value = type === 'full' ? remaining : amount;
  const amountError =
    type === 'full'
      ? undefined
      : amount === ''
        ? 'Enter the amount to refund.'
        : amount <= 0
          ? 'Amount must be greater than 0.'
          : amount > remaining
            ? `Amount cannot exceed ${formatMoney(remaining)}.`
            : undefined;
  const noteError = reason === 'other' && !note.trim() ? 'Describe the reason for this refund.' : undefined;

  const submit = async () => {
    setSubmitted(true);
    if (amountError || noteError || value === '') return;
    setSaving(true);
    setServerError(null);
    try {
      const updated = await orderService.createRefund({ orderId: order.id, type, amount: value, reason, note: note.trim() || undefined, restock });
      toast.success('Refund recorded.', { description: `${formatMoney(value)} on ${order.number}` });
      refreshBadges();
      onDone(cloneOrder(updated));
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Refund could not be recorded.';
      setServerError(msg);
      toast.error('Refund not recorded.', { description: msg });
    } finally {
      setSaving(false);
    }
  };

  const facts = [
    { label: 'Order', value: <span className="font-mono font-semibold">#{order.number}</span> },
    { label: 'Customer', value: order.customerName },
    {
      label: 'Payment',
      value: (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {PAYMENT_METHOD[order.payment.method]} <StatusBadge map={PAYMENT_STATUS} value={order.payment.status} />
        </span>
      ),
    },
    { label: 'Paid amount', value: formatMoney(order.payment.amount) },
    { label: 'Already refunded', value: formatMoney(order.payment.refundedAmount) },
    { label: 'Remaining refundable', value: <strong className="text-zinc-950">{formatMoney(remaining)}</strong> },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title="Issue refund"
      description="Refunds are logged on the order timeline and in the activity log."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" loading={saving} onClick={() => void submit()} disabled={remaining <= 0}>
            Refund {value !== '' && !amountError ? formatMoney(value) : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-xs font-medium text-zinc-500">{f.label}</dt>
              <dd className="mt-0.5 text-[0.8125rem] text-zinc-800 tabular">{f.value}</dd>
            </div>
          ))}
        </dl>

        <RadioGroup
          label="Refund type"
          variant="cards"
          value={type}
          onChange={setType}
          options={[
            { value: 'full', label: 'Full refund', description: `Refund the remaining ${formatMoney(remaining)}` },
            { value: 'partial', label: 'Partial refund', description: 'Refund a specific amount' },
          ]}
        />

        {type === 'partial' && <CurrencyInput label="Refund amount" required value={amount} onValueChange={setAmount} max={remaining} error={submitted || amount !== '' ? amountError : undefined} help={`Maximum ${formatMoney(remaining)}`} />}

        <Select label="Reason" required value={reason} onChange={(e) => setReason(e.target.value as RefundReason)} options={REFUND_REASONS} />
        <Textarea label="Note" required={reason === 'other'} optional={reason !== 'other'} rows={3} maxLength={500} showCount value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible to admins only" error={submitted ? noteError : undefined} />
        <Toggle checked={restock} onChange={setRestock} label="Restock items" description={`Return ${order.itemsCount} unit${order.itemsCount === 1 ? '' : 's'} to inventory for the variants in this order.`} />

        <div className="flex items-start gap-2 rounded-lg border border-sky-200/70 bg-sky-50 px-3 py-2.5 text-[0.8125rem] text-sky-800">
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>Frontend phase: this records the refund only. No money is moved until the payment provider integration is connected on the backend.</span>
        </div>

        {serverError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[0.8125rem] text-red-700">
            <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
            {serverError}
          </div>
        )}
      </div>
    </Modal>
  );
}
