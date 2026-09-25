import { Link } from 'react-router-dom';
import { Mail, MapPin, MessageSquareQuote, Phone } from 'lucide-react';
import type { Order } from '@/types';
import { Avatar, DescriptionList, Panel } from '@/components/common';

/** Customer identity, contact details, delivery address and the note left at checkout. */
export function OrderCustomerPanel({ order }: { order: Order }) {
  const a = order.shipping.address;
  return (
    <Panel title="Customer">
      <div className="flex items-center gap-3">
        <Avatar name={order.customerName} size={40} />
        <div className="min-w-0">
          <Link to={`/customers/${order.customerId}`} className="block truncate text-sm font-semibold text-zinc-950 hover:underline">
            {order.customerName}
          </Link>
          <span className="text-xs text-zinc-500">View customer profile</span>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-[0.8125rem]">
        <li className="flex items-center gap-2.5 text-zinc-700">
          <Mail size={14} className="shrink-0 text-zinc-400" aria-hidden />
          <a href={`mailto:${order.customerEmail}`} className="truncate hover:underline">
            {order.customerEmail}
          </a>
        </li>
        <li className="flex items-center gap-2.5 text-zinc-700">
          <Phone size={14} className="shrink-0 text-zinc-400" aria-hidden />
          <a href={`tel:${order.customerPhone.replace(/\s/g, '')}`} className="tabular hover:underline">
            {order.customerPhone}
          </a>
        </li>
      </ul>

      {order.customerNote && (
        <div className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/60 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <MessageSquareQuote size={13} aria-hidden /> Customer note
          </p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-zinc-800">“{order.customerNote}”</p>
        </div>
      )}

      <div className="mt-5 border-t border-zinc-100 pt-4">
        <p className="eyebrow mb-2 flex items-center gap-1.5">
          <MapPin size={12} aria-hidden /> Shipping address
        </p>
        <DescriptionList
          columns={2}
          items={[
            { label: 'Recipient', value: a.fullName },
            { label: 'Phone', value: <span className="tabular">{a.phone}</span> },
            { label: 'Address', value: [a.line1, a.line2].filter(Boolean).join(', ') },
            { label: 'District', value: a.district || '—' },
            { label: 'City', value: a.city },
            { label: 'Country', value: a.country },
            { label: 'Postal code', value: a.postalCode, hidden: !a.postalCode },
          ]}
        />
      </div>
    </Panel>
  );
}
