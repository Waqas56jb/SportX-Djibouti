import { useState } from 'react';
import { Copy, PencilLine, Truck, Waypoints } from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import { SHIPPING_STATUS } from '@/constants/status';
import { formatDate, formatDateTime, formatMoney } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { usePermission } from '@/hooks/usePermission';
import { Button, DescriptionList, IconButton, Panel, StatusBadge } from '@/components/common';
import { canTransition } from './orderMeta';
import { TrackingModal } from './ShippingModals';

export function OrderShippingPanel({ order, onChange, onStatus, busy }: { order: Order; onChange: (o: Order) => void; onStatus: (s: OrderStatus) => void; busy?: boolean }) {
  const s = order.shipping;
  const canEdit = usePermission('orders:edit');
  const [modal, setModal] = useState<'tracking' | null>(null);
  const closed = order.status === 'cancelled' || order.status === 'refunded';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(s.trackingNumber ?? '');
      toast.success('Tracking number copied.');
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  return (
    <Panel
      title="Shipping"
      actions={<StatusBadge map={SHIPPING_STATUS} value={s.status} size="md" />}
      footer={<p className="text-xs text-zinc-500">Shipping status follows the order status (packed, shipped, out for delivery, delivered).</p>}
    >
      <DescriptionList
        columns={2}
        items={[
          { label: 'Method', value: s.method },
          { label: 'Delivery', value: s.address ? s.address.city : 'Pickup / no address' },
          { label: 'Cost', value: s.cost ? formatMoney(s.cost) : 'Free' },
          { label: 'Carrier', value: s.carrier ?? <span className="text-zinc-400">Not assigned</span> },
          {
            label: 'Tracking number',
            value: s.trackingNumber ? (
              <span className="inline-flex items-center gap-1">
                <span className="break-all font-mono text-xs font-semibold">{s.trackingNumber}</span>
                <IconButton icon={Copy} label="Copy tracking number" size="sm" onClick={() => void copy()} className="-my-1 h-7 w-7 print:hidden" />
              </span>
            ) : (
              <span className="text-zinc-400">None yet</span>
            ),
          },
          { label: 'Estimated delivery', value: s.estimatedDelivery ? formatDate(s.estimatedDelivery) : '—' },
          { label: 'Shipped', value: s.shippedAt ? formatDateTime(s.shippedAt) : '—' },
          { label: 'Delivered', value: s.deliveredAt ? formatDateTime(s.deliveredAt) : '—', hidden: !s.deliveredAt && s.status !== 'delivered' },
        ]}
      />

      {canEdit && !closed && (
        <div className="mt-5 flex flex-wrap gap-2 print:hidden">
          <Button size="sm" variant="secondary" icon={s.trackingNumber ? PencilLine : Waypoints} onClick={() => setModal('tracking')}>
            {s.trackingNumber ? 'Edit tracking' : 'Add tracking number'}
          </Button>
          {canTransition(order, 'shipped') && (
            <Button size="sm" variant="primary" icon={Truck} loading={busy} onClick={() => onStatus('shipped')}>
              Mark shipped
            </Button>
          )}
        </div>
      )}

      <TrackingModal open={modal === 'tracking'} order={order} onClose={() => setModal(null)} onDone={onChange} />
    </Panel>
  );
}
