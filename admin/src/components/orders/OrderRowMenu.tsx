import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, Printer, XCircle } from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import { usePermission } from '@/hooks/usePermission';
import { toast } from '@/store/toastStore';
import { Menu, type MenuItem } from '@/components/common';
import { canCancel, nextStatuses, STATUS_ACTION_LABEL } from './orderMeta';
import { printInvoice } from './invoice';

/** Per-row actions for the orders table. Only valid transitions (ORDER_TRANSITIONS) are offered. */
export function OrderRowMenu({ order, onStatus, busy }: { order: Order; onStatus: (o: Order, s: OrderStatus) => void; busy?: boolean }) {
  const navigate = useNavigate();
  const canEdit = usePermission('orders:edit');
  const next = nextStatuses(order);
  const items: MenuItem[] = [
    { label: 'View order', icon: Eye, onSelect: () => navigate(`/orders/${order.id}`) },
    {
      label: 'Print invoice',
      icon: Printer,
      onSelect: () => {
        if (!printInvoice(order)) toast.info('Invoice downloaded.', { description: 'Pop-ups are blocked, so the invoice was saved as a file instead.' });
      },
    },
    ...next.map<MenuItem>((s, i) => ({ label: STATUS_ACTION_LABEL[s], icon: ArrowRight, separator: i === 0, hidden: !canEdit, disabled: busy, onSelect: () => onStatus(order, s) })),
    { label: 'Cancel order', icon: XCircle, danger: true, separator: true, hidden: !canEdit || !canCancel(order), disabled: busy, onSelect: () => onStatus(order, 'cancelled') },
  ];
  return <Menu label={`Actions for order ${order.number}`} width={220} items={items} />;
}
