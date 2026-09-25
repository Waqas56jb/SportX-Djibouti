import { useEffect, useState } from 'react';
import type { Order, ShippingUpdateInput } from '@/types';
import { orderService } from '@/services/orderService';
import { toast } from '@/store/toastStore';
import { toDateInput } from '@/utils/format';
import { Button } from '@/components/common';
import { DateInput, Input, Select } from '@/components/forms';
import { Modal } from '@/components/modals/Overlay';

export const CARRIERS = ['SPORTX Courier', 'Partner courier'];

async function save(order: Order, input: ShippingUpdateInput, success: string): Promise<Order | undefined> {
  try {
    const o = await orderService.updateShipping(order.id, input);
    toast.success(success, { description: order.number });
    return o;
  } catch (e) {
    toast.error('Shipping not updated.', { description: e instanceof Error ? e.message : undefined });
    return undefined;
  }
}

/** Add or edit carrier + tracking number. */
export function TrackingModal({ open, order, onClose, onDone }: { open: boolean; order: Order; onClose: () => void; onDone: (o: Order) => void }) {
  const [carrier, setCarrier] = useState(CARRIERS[0]);
  const [tracking, setTracking] = useState('');
  const [eta, setEta] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCarrier(order.shipping.carrier || CARRIERS[0]);
    setTracking(order.shipping.trackingNumber ?? '');
    setEta(toDateInput(order.shipping.estimatedDelivery));
    setSubmitted(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = tracking.trim();
  const error = !trimmed ? 'Tracking number is required.' : !/^[A-Za-z0-9-]{4,80}$/.test(trimmed) ? 'Use 4–80 letters, numbers or dashes.' : undefined;

  const submit = async () => {
    setSubmitted(true);
    if (error) return;
    setSaving(true);
    const o = await save(order, { carrier, trackingNumber: trimmed.toUpperCase(), estimatedDelivery: eta ? new Date(`${eta}T12:00:00`).toISOString() : order.shipping.estimatedDelivery ? null : undefined }, 'Tracking number saved.');
    setSaving(false);
    if (o) {
      onDone(o);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      size="sm"
      title={order.shipping.trackingNumber ? 'Edit tracking' : 'Add tracking number'}
      description="Shared with the customer in shipping notifications."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            Save tracking
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Select label="Carrier" required value={carrier} onChange={(e) => setCarrier(e.target.value)} options={[...new Set([...CARRIERS, carrier])].map((c) => ({ value: c, label: c }))} />
        <Input label="Tracking number" required value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. SPX-DJ-482913" error={submitted ? error : undefined} data-autofocus autoComplete="off" inputClassName="font-mono uppercase" />
        <DateInput label="Estimated delivery" optional value={eta} onChange={(e) => setEta(e.target.value)} />
        <p className="text-xs text-zinc-500">The tracking number is added to the order timeline and included in the “order shipped” email.</p>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
