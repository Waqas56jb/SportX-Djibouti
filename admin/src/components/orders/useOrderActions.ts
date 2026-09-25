import { createElement, useCallback, useRef, useState } from 'react';
import type { Order, OrderStatus } from '@/types';
import { orderService } from '@/services/orderService';
import { ORDER_STATUS } from '@/constants/status';
import { toast } from '@/store/toastStore';
import { useNotificationStore } from '@/store/notificationStore';
import { CancelOrderModal } from './CancelOrderModal';

/** Kept for call sites that cloned mock objects; API responses are already fresh objects. */
export const cloneOrder = (o: Order): Order => o;

export const refreshBadges = () => void useNotificationStore.getState().refreshCounts();

/**
 * Status changes shared by the orders list and detail page.
 * Cancelling opens a dialog (reason + optional refund) — render `cancelDialog` in the page.
 * Returns the updated order, or undefined if aborted/failed.
 */
export function useOrderActions() {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const resolver = useRef<((o: Order | undefined) => void) | null>(null);

  const changeStatus = useCallback(async (order: Order, status: OrderStatus, note?: string): Promise<Order | undefined> => {
    if (status === 'cancelled') {
      resolver.current?.(undefined);
      return new Promise<Order | undefined>((resolve) => {
        resolver.current = resolve;
        setCancelTarget(order);
      });
    }
    setPendingId(order.id);
    try {
      const updated = await orderService.updateOrderStatus(order.id, status, note);
      toast.success(`Order marked as ${ORDER_STATUS[status].label.toLowerCase()}.`, { description: order.number });
      refreshBadges();
      return updated;
    } catch (e) {
      toast.error('Status not updated.', { description: e instanceof Error ? e.message : undefined });
      return undefined;
    } finally {
      setPendingId(null);
    }
  }, []);

  const finish = (o: Order | undefined) => {
    resolver.current?.(o);
    resolver.current = null;
    setCancelTarget(null);
    if (o) refreshBadges();
  };

  const cancelDialog = createElement(CancelOrderModal, { order: cancelTarget, onClose: () => finish(undefined), onDone: (o: Order) => finish(o) });

  return { changeStatus, pendingId, cancelDialog };
}
