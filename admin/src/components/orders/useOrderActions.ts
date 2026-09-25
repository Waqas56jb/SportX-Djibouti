import { useCallback, useState } from 'react';
import type { Order, OrderStatus } from '@/types';
import { orderService } from '@/services/orderService';
import { ORDER_STATUS } from '@/constants/status';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { useNotificationStore } from '@/store/notificationStore';

/** Service calls return the live mock object — clone so React sees a new reference. */
export const cloneOrder = (o: Order): Order => ({ ...o, payment: { ...o.payment }, shipping: { ...o.shipping }, timeline: [...o.timeline], refunds: [...o.refunds] });

export const refreshBadges = () => void useNotificationStore.getState().refreshCounts();

/**
 * Status changes shared by the orders list and detail page.
 * Cancel asks for confirmation. Returns the updated order, or undefined if aborted/failed.
 */
export function useOrderActions() {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const changeStatus = useCallback(async (order: Order, status: OrderStatus, note?: string): Promise<Order | undefined> => {
    if (status === 'cancelled') {
      const ok = await confirm({
        title: `Cancel order ${order.number}?`,
        description: 'Reserved stock is released and the customer can no longer receive this order. Captured payments must be refunded separately.',
        confirmLabel: 'Cancel order',
        cancelLabel: 'Keep order',
      });
      if (!ok) return undefined;
    }
    setPendingId(order.id);
    try {
      const updated = cloneOrder(await orderService.updateOrderStatus(order.id, status, note));
      toast.success(status === 'cancelled' ? 'Order cancelled.' : `Order marked as ${ORDER_STATUS[status].label.toLowerCase()}.`, { description: order.number });
      refreshBadges();
      return updated;
    } catch (e) {
      toast.error('Status not updated.', { description: e instanceof Error ? e.message : undefined });
      return undefined;
    } finally {
      setPendingId(null);
    }
  }, []);

  return { changeStatus, pendingId };
}
