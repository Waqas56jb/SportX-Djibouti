import { useNavigate } from 'react-router-dom';
import { PackagePlus, Plus, ReceiptText, TicketPercent } from 'lucide-react';
import { Button, DemoBadge } from '@/components/common';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermission';
import { useDocumentTitle } from '@/hooks/misc';
import { greeting } from '@/utils/format';
import type { PermissionKey } from '@/types';
import type { LucideIcon } from 'lucide-react';

const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

interface QuickAction {
  label: string;
  to: string;
  icon: LucideIcon;
  permission: PermissionKey;
  primary?: boolean;
}

const ACTIONS: QuickAction[] = [
  { label: 'VIEW ORDERS', to: '/orders', icon: ReceiptText, permission: 'orders:view' },
  { label: 'CREATE DISCOUNT', to: '/discounts/coupons?new=1', icon: TicketPercent, permission: 'discounts:create' },
  { label: 'ADD STOCK', to: '/inventory?adjust=1', icon: PackagePlus, permission: 'inventory:edit' },
  { label: 'ADD PRODUCT', to: '/products/new', icon: Plus, permission: 'products:create', primary: true },
];

export function DashboardHeader() {
  const name = useAuthStore((s) => s.session?.user.name) ?? '';
  const can = usePermissions();
  const navigate = useNavigate();
  const first = name.split(/\s+/)[0] || 'there';
  useDocumentTitle('Dashboard');
  const actions = ACTIONS.filter((a) => can(a.permission));

  return (
    <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <time dateTime={new Date().toISOString().slice(0, 10)} className="eyebrow">
            {longDate.format(new Date())}
          </time>
          <DemoBadge />
        </div>
        <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[2rem]">
          {greeting()}, {first}.
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Here’s how SPORTX is trading, and what needs your attention today.</p>
      </div>
      {actions.length > 0 && (
        <nav aria-label="Quick actions" className="flex flex-wrap items-center gap-2">
          {actions.map((a) => (
            <Button key={a.to} variant={a.primary ? 'primary' : 'secondary'} size="sm" icon={a.icon} onClick={() => navigate(a.to)}>
              {a.label}
            </Button>
          ))}
        </nav>
      )}
    </header>
  );
}
