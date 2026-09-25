import { useState } from 'react';
import { Ban, UserCheck, UserMinus } from 'lucide-react';
import type { Customer, CustomerStatus } from '@/types';
import type { MenuItem } from '@/components/common';
import { customerService } from '@/services/customerService';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';

/** Cities customers ship to. Mirrors the store's delivery zones in Djibouti. */
export const CUSTOMER_CITIES = ['Djibouti', 'Ali Sabieh', 'Tadjourah', 'Dikhil', 'Arta', 'Obock'];

export const fullName = (c: Pick<Customer, 'firstName' | 'lastName'>) => `${c.firstName} ${c.lastName}`.trim();

const SUCCESS: Record<CustomerStatus, string> = {
  active: 'Customer reactivated.',
  inactive: 'Customer deactivated.',
  blocked: 'Customer blocked.',
};

/**
 * Status changes with confirmation for destructive transitions (deactivate / block).
 * Returns the updated customer, or undefined when cancelled or failed.
 */
export function useCustomerStatus() {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const change = async (c: Customer, status: CustomerStatus): Promise<Customer | undefined> => {
    if (c.status === status) return undefined;
    const name = fullName(c);
    if (status === 'blocked') {
      const ok = await confirm({
        title: `Block ${name}?`,
        description: 'Blocked customers can’t sign in, check out or contact support through their account. You can reactivate them at any time.',
        confirmLabel: 'Block Customer',
        tone: 'danger',
      });
      if (!ok) return undefined;
    }
    if (status === 'inactive') {
      const ok = await confirm({
        title: `Deactivate ${name}?`,
        description: 'The account is disabled and excluded from marketing. Order history is kept.',
        confirmLabel: 'Deactivate',
        tone: 'danger',
      });
      if (!ok) return undefined;
    }
    setPendingId(c.id);
    try {
      const updated = await customerService.setStatus(c.id, status);
      toast.success(SUCCESS[status], { description: name });
      return updated;
    } catch (e) {
      toast.error('Could not change customer status', { description: e instanceof Error ? e.message : undefined });
      return undefined;
    } finally {
      setPendingId(null);
    }
  };

  return { change, pendingId };
}

/** Menu entries for status transitions, hiding the current status. */
export function statusMenuItems(c: Customer, onChange: (status: CustomerStatus) => void, separator = true): MenuItem[] {
  return [
    { label: 'Reactivate', icon: UserCheck, onSelect: () => onChange('active'), hidden: c.status === 'active', separator },
    { label: 'Deactivate', icon: UserMinus, onSelect: () => onChange('inactive'), hidden: c.status === 'inactive', separator: separator && c.status === 'active' },
    { label: 'Block customer', icon: Ban, onSelect: () => onChange('blocked'), hidden: c.status === 'blocked', danger: true },
  ];
}
