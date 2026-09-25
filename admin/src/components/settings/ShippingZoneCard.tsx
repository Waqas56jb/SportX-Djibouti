import { MapPin, Pencil, Plus, Trash2, Truck } from 'lucide-react';
import type { ShippingMethod, ShippingZone } from '@/types';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/utils/format';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Menu } from '@/components/common/Menu';
import { EmptyState } from '@/components/common/States';
import { Toggle } from '@/components/forms/Choice';

export interface ZoneCardProps {
  zone: ShippingZone;
  canEdit: boolean;
  onToggleZone: (enabled: boolean) => void;
  onEditZone: () => void;
  onDeleteZone: () => void;
  onAddMethod: () => void;
  onEditMethod: (m: ShippingMethod) => void;
  onDeleteMethod: (m: ShippingMethod) => void;
  onToggleMethod: (m: ShippingMethod, enabled: boolean) => void;
}

export function ShippingZoneCard({ zone, canEdit, onToggleZone, onEditZone, onDeleteZone, onAddMethod, onEditMethod, onDeleteMethod, onToggleMethod }: ZoneCardProps) {
  const activeMethods = zone.methods.filter((m) => m.enabled).length;
  return (
    <section className={cn('panel overflow-hidden transition-opacity', !zone.enabled && 'bg-zinc-50/60')} aria-labelledby={`zone-${zone.id}`}>
      <header className="flex flex-col gap-4 border-b border-zinc-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3.5">
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', zone.enabled ? 'bg-ink-950 text-volt' : 'bg-zinc-200 text-zinc-500')}>
            <MapPin size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`zone-${zone.id}`} className="panel-title">
                {zone.name}
              </h2>
              <Badge tone={zone.enabled ? 'success' : 'muted'} dot>
                {zone.enabled ? 'Active' : 'Disabled'}
              </Badge>
              <span className="text-xs text-zinc-500 tabular">
                {activeMethods}/{zone.methods.length} methods live
              </span>
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Regions in ${zone.name}`}>
              {zone.regions.map((r) => (
                <li key={r} className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
          <Toggle size="sm" label={`${zone.name} zone enabled`} checked={zone.enabled} onChange={onToggleZone} disabled={!canEdit} className="[&_label]:sr-only" />
          {canEdit && (
            <>
              <Button size="sm" icon={Plus} onClick={onAddMethod}>
                Add method
              </Button>
              <Menu
                label={`Actions for ${zone.name}`}
                items={[
                  { label: 'Edit zone', icon: Pencil, onSelect: onEditZone },
                  { label: 'Delete zone', icon: Trash2, danger: true, separator: true, onSelect: onDeleteZone },
                ]}
              />
            </>
          )}
        </div>
      </header>

      {zone.methods.length === 0 ? (
        <EmptyState compact icon={Truck} title="No delivery methods yet" description="Customers in this zone can’t check out until at least one method is enabled." action={canEdit ? <Button size="sm" variant="primary" icon={Plus} onClick={onAddMethod}>Add method</Button> : undefined} />
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <caption className="sr-only">Shipping methods for {zone.name}</caption>
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/70 text-2xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                <th scope="col" className="px-5 py-2.5">Method</th>
                <th scope="col" className="px-3 py-2.5 text-right">Price</th>
                <th scope="col" className="px-3 py-2.5 text-right">Free over</th>
                <th scope="col" className="px-3 py-2.5">Estimated delivery</th>
                <th scope="col" className="px-3 py-2.5 text-center">Enabled</th>
                <th scope="col" className="w-12 pr-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {zone.methods.map((m) => (
                <tr key={m.id} className={cn('border-b border-zinc-100 last:border-0 hover:bg-zinc-50/70', !m.enabled && 'text-zinc-400')}>
                  <td className="max-w-[340px] px-5 py-3">
                    <p className={cn('text-[0.8125rem] font-medium', m.enabled ? 'text-zinc-900' : 'text-zinc-500')}>{m.name}</p>
                    {m.description && <p className="mt-0.5 truncate text-xs text-zinc-500" title={m.description}>{m.description}</p>}
                  </td>
                  <td className="px-3 py-3 text-right text-[0.8125rem] font-medium tabular text-zinc-900">{m.price === 0 ? <Badge tone="success">Free</Badge> : formatMoney(m.price)}</td>
                  <td className="px-3 py-3 text-right text-[0.8125rem] tabular text-zinc-700">{m.freeShippingThreshold ? formatMoney(m.freeShippingThreshold) : <span className="text-zinc-400">—</span>}</td>
                  <td className="px-3 py-3 text-[0.8125rem] text-zinc-700">{m.estimatedDelivery}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-center">
                      <Toggle size="sm" label={`${m.name} enabled`} checked={m.enabled} onChange={(v) => onToggleMethod(m, v)} disabled={!canEdit} className="[&_label]:sr-only" />
                    </div>
                  </td>
                  <td className="pr-4 text-right">
                    {canEdit && (
                      <Menu
                        label={`Actions for ${m.name}`}
                        items={[
                          { label: 'Edit method', icon: Pencil, onSelect: () => onEditMethod(m) },
                          { label: 'Delete method', icon: Trash2, danger: true, separator: true, onSelect: () => onDeleteMethod(m) },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
