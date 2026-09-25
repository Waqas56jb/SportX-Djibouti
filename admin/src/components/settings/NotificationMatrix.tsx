import { AlertTriangle, Bell, CreditCard, LifeBuoy, Mail, MessageSquare, PackageMinus, ReceiptText, ShoppingBag, Star, UserPlus, type LucideIcon } from 'lucide-react';
import type { NotificationChannel, NotificationPreference, NotificationType } from '@/types';
import { Checkbox } from '@/components/forms/Choice';

export const CHANNELS: { id: NotificationChannel; label: string; icon: LucideIcon; hint: string }[] = [
  { id: 'email', label: 'Email', icon: Mail, hint: 'To the admin’s work inbox' },
  { id: 'sms', label: 'SMS', icon: MessageSquare, hint: 'Urgent events only' },
  { id: 'in_app', label: 'In-app', icon: Bell, hint: 'Bell menu in the admin' },
];

const EVENT_META: Record<NotificationType, { icon: LucideIcon; recipients: string; urgent?: boolean }> = {
  new_order: { icon: ShoppingBag, recipients: 'admins with Orders permission' },
  payment_failed: { icon: CreditCard, recipients: 'admins with Orders permission', urgent: true },
  low_stock: { icon: PackageMinus, recipients: 'admins with Inventory permission' },
  refund_requested: { icon: ReceiptText, recipients: 'admins who can approve Orders', urgent: true },
  new_customer: { icon: UserPlus, recipients: 'admins with Customers permission' },
  review_pending: { icon: Star, recipients: 'admins who can approve Reviews' },
  new_ticket: { icon: LifeBuoy, recipients: 'admins with Support permission', urgent: true },
};

export function NotificationMatrix({ prefs, onChange, disabled }: { prefs: NotificationPreference[]; onChange: (next: NotificationPreference[]) => void; disabled?: boolean }) {
  const setCell = (event: NotificationType, ch: NotificationChannel, on: boolean) =>
    onChange(prefs.map((p) => (p.event === event ? { ...p, channels: { ...p.channels, [ch]: on } } : p)));
  const setColumn = (ch: NotificationChannel, on: boolean) => onChange(prefs.map((p) => ({ ...p, channels: { ...p.channels, [ch]: on } })));

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[680px] border-collapse text-left">
        <caption className="sr-only">Notification channels per event</caption>
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50/70">
            <th scope="col" className="px-5 py-3 text-2xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Event
            </th>
            {CHANNELS.map((c) => {
              const count = prefs.filter((p) => p.channels[c.id]).length;
              return (
                <th key={c.id} scope="col" className="w-36 px-3 py-3 text-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-zinc-700">
                      <c.icon size={13} aria-hidden /> {c.label}
                    </span>
                    <Checkbox
                      ariaLabel={`Toggle ${c.label} for all events`}
                      checked={count === prefs.length && prefs.length > 0}
                      indeterminate={count > 0}
                      disabled={disabled}
                      onChange={(on) => setColumn(c.id, on)}
                    />
                    <span className="text-2xs font-normal normal-case text-zinc-400 tabular">
                      {count}/{prefs.length} on
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {prefs.map((p) => {
            const meta = EVENT_META[p.event] ?? { icon: Bell, recipients: 'all admins' };
            return (
              <tr key={p.event} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                <th scope="row" className="px-5 py-3.5 text-left font-normal">
                  <div className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                      <meta.icon size={16} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-900">
                        {p.label}
                        {meta.urgent && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-px text-2xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200/80">
                            <AlertTriangle size={10} aria-hidden /> Time-sensitive
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">{p.description}</p>
                      <p className="mt-1 text-xs text-zinc-400">Sent to {meta.recipients}</p>
                    </div>
                  </div>
                </th>
                {CHANNELS.map((c) => (
                  <td key={c.id} className="px-3 py-3.5">
                    <div className="flex justify-center">
                      <Checkbox ariaLabel={`${p.label}: ${c.label}`} checked={p.channels[c.id]} disabled={disabled} onChange={(on) => setCell(p.event, c.id, on)} />
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
