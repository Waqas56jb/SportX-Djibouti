import { Calendar, CreditCard, Mail, MapPin, Phone, ShoppingBag, TrendingUp, type LucideIcon } from 'lucide-react';
import type { Customer } from '@/types';
import { Badge, EmptyState, Panel } from '@/components/common';
import { formatDate, formatMoney, formatNumber, formatRelative } from '@/utils/format';

function StatTile({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div className="panel flex items-start gap-3 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
        <Icon size={17} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <p className="mt-1 truncate font-display text-[1.625rem] font-bold leading-none text-zinc-950 tabular">{value}</p>
        {hint && <p className="mt-1.5 truncate text-xs text-zinc-500">{hint}</p>}
      </div>
    </div>
  );
}

export function CustomerStats({ customer: c }: { customer: Customer }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile icon={ShoppingBag} label="Total orders" value={formatNumber(c.ordersCount)} hint={c.ordersCount >= 2 ? 'Returning customer' : c.ordersCount === 1 ? 'First-time buyer' : 'No purchases yet'} />
      <StatTile icon={CreditCard} label="Total spent" value={formatMoney(c.totalSpent, { compact: true })} hint={formatMoney(c.totalSpent)} />
      <StatTile icon={TrendingUp} label="Average order" value={formatMoney(c.averageOrder, { compact: true })} hint="Per completed order" />
      <StatTile icon={Calendar} label="Last order" value={c.lastOrderAt ? formatRelative(c.lastOrderAt) : '—'} hint={c.lastOrderAt ? formatDate(c.lastOrderAt) : 'Never ordered'} />
    </div>
  );
}

function ContactRow({ icon: Icon, label, children, href }: { icon: LucideIcon; label: string; children: string; href?: string }) {
  return (
    <li className="flex items-start gap-3">
      <Icon size={15} className="mt-0.5 shrink-0 text-zinc-400" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        {href ? (
          <a href={href} className="block break-all text-sm font-medium text-zinc-900 underline-offset-4 hover:underline">
            {children}
          </a>
        ) : (
          <p className="text-sm text-zinc-900">{children}</p>
        )}
      </div>
    </li>
  );
}

export function ContactPanel({ customer: c }: { customer: Customer }) {
  const def = c.addresses.find((a) => a.isDefault) ?? c.addresses[0];
  return (
    <Panel title="Contact details">
      <ul className="space-y-4">
        <ContactRow icon={Mail} label="Email" href={`mailto:${c.email}`}>
          {c.email}
        </ContactRow>
        <ContactRow icon={Phone} label="Phone" href={`tel:${c.phone.replace(/\s/g, '')}`}>
          {c.phone}
        </ContactRow>
        <ContactRow icon={MapPin} label="City">
          {def ? `${def.city}, ${def.country}` : '—'}
        </ContactRow>
      </ul>
      <div className="mt-5 border-t border-zinc-100 pt-4">
        <p className="text-xs font-medium text-zinc-500">Internal notes</p>
        {c.notes ? (
          <p className="mt-1.5 whitespace-pre-line rounded-lg border border-dashed border-amber-300 bg-amber-50/70 px-3 py-2 text-[0.8125rem] leading-relaxed text-amber-900">{c.notes}</p>
        ) : (
          <p className="mt-1 text-[0.8125rem] text-zinc-400">No notes yet.</p>
        )}
      </div>
    </Panel>
  );
}

export function AddressesPanel({ customer: c }: { customer: Customer }) {
  const list = [...c.addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return (
    <Panel title="Addresses" description={`${list.length} saved`} flush>
      {list.length === 0 ? (
        <EmptyState compact icon={MapPin} title="No saved addresses" />
      ) : (
        <ul className="divide-y divide-zinc-100">
          {list.map((a) => (
            <li key={a.id} className="px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900">{a.label}</p>
                {a.isDefault && (
                  <Badge tone="brand" dot>
                    Default
                  </Badge>
                )}
              </div>
              <address className="mt-1.5 text-[0.8125rem] not-italic leading-relaxed text-zinc-600">
                {a.fullName}
                <br />
                {a.line1}
                {a.line2 && (
                  <>
                    <br />
                    {a.line2}
                  </>
                )}
                <br />
                {[a.district, a.city, a.postalCode].filter(Boolean).join(', ')}
                <br />
                {a.country} · <span className="tabular">{a.phone}</span>
              </address>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
