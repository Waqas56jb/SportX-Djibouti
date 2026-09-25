import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { Order } from '@/types';
import { orderService } from '@/services/orderService';
import { formatMoney } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { Button } from '@/components/common';
import { Textarea, Toggle } from '@/components/forms';
import { Modal } from '@/components/modals/Overlay';

/**
 * Cancels an order via POST /admin/orders/:id/cancel. The server releases reserved stock (or restocks
 * committed stock) and, when `refund` is on, refunds a captured payment through the provider.
 */
export function CancelOrderModal({ order, onClose, onDone }: { order: Order | null; onClose: () => void; onDone: (o: Order) => void }) {
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    setReason('');
    setRefund(true);
    setSubmitted(false);
    setServerError(null);
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order) return null;
  const paid = ['paid', 'partially_refunded'].includes(order.payment.status);
  const remaining = Math.max(0, order.payment.amount - order.payment.refundedAmount);
  const reasonError = reason.trim().length < 2 ? 'Give a short reason (shown to the customer).' : undefined;

  const submit = async () => {
    setSubmitted(true);
    if (reasonError) return;
    setSaving(true);
    setServerError(null);
    try {
      const updated = await orderService.cancelOrder(order.id, { reason: reason.trim(), refund: paid && refund });
      toast.success('Order cancelled.', { description: order.number });
      onDone(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'The order could not be cancelled.';
      setServerError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="sm"
      title={`Cancel order ${order.number}?`}
      description="Reserved stock is released and the customer is notified. This cannot be undone."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Keep order
          </Button>
          <Button variant="danger" loading={saving} onClick={() => void submit()}>
            Cancel order
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Textarea label="Reason" required rows={3} maxLength={300} showCount value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer asked to cancel by phone" error={submitted ? reasonError : undefined} data-autofocus />
        {paid && (
          <Toggle checked={refund} onChange={setRefund} label={`Refund ${formatMoney(remaining)} to the customer`} description="Refunds the captured payment through the payment provider. Turn off to refund later from the order." />
        )}
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
