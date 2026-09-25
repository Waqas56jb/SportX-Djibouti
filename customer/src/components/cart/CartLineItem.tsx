import { Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Price, QuantitySelector, SmartImage } from '@/components/common';
import { productPath } from '@/constants/routes';
import type { CartItem } from '@/types';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format';

interface CartLineItemProps {
  item: CartItem;
  onQuantity: (qty: number) => void;
  onRemove: () => void;
  onNavigate?: () => void;
  size?: 'compact' | 'full';
  /** Disable controls while a server update is in flight. */
  busy?: boolean;
}

export function CartLineItem({ item, onQuantity, onRemove, onNavigate, size = 'compact', busy }: CartLineItemProps) {
  const full = size === 'full';
  // Server lines already cap maxStock at min(stock, per-line limit); guest lines are capped by the store.
  const max = item.maxStock;
  const blocked = item.status !== undefined && item.status !== 'OK';
  const lineTotal = item.lineTotal ?? item.unitPrice * item.quantity;
  return (
    <li className={cn('flex gap-4', full ? 'py-6 sm:gap-6' : 'py-5', blocked && 'opacity-80')}>
      <Link to={productPath(item.slug)} onClick={onNavigate} className={cn('relative shrink-0 overflow-hidden bg-paper-100', full ? 'w-24 sm:w-32' : 'w-20')}>
        <div className="aspect-[4/5]">
          <SmartImage src={item.image} alt={item.name} sizes="128px" maxWidth={320} wrapperClassName="absolute inset-0" />
        </div>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-500">{item.brand}</p>
            <Link to={productPath(item.slug)} onClick={onNavigate} className="mt-1 block text-sm font-semibold leading-snug text-ink hover:underline sm:text-[15px]">
              {item.name}
            </Link>
            <dl className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-500">
              <div className="flex gap-1">
                <dt>Colour:</dt>
                <dd className="text-ink-700">{item.color}</dd>
              </div>
              <div className="flex gap-1">
                <dt>Size:</dt>
                <dd className="text-ink-700">{item.size}</dd>
              </div>
            </dl>
          </div>
          {full && (
            <div className="hidden text-right sm:block">
              <p className="text-[15px] font-semibold tabular-nums">{formatPrice(lineTotal)}</p>
              {item.quantity > 1 && <p className="text-xs text-ink-500">{formatPrice(item.unitPrice)} each</p>}
            </div>
          )}
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          {blocked ? (
            <span className="text-xs font-semibold text-danger">{item.status === 'OUT_OF_STOCK' ? 'Out of stock' : 'No longer available'} — remove to continue</span>
          ) : (
            <QuantitySelector size="sm" value={item.quantity} onChange={onQuantity} max={Math.max(max, 1)} disabled={busy} label={`Quantity for ${item.name}`} />
          )}
          <div className="flex items-center gap-3">
            {!full && <Price price={lineTotal} compareAtPrice={item.compareAtPrice ? item.compareAtPrice * item.quantity : undefined} size="sm" className="justify-end" />}
            <button type="button" onClick={onRemove} className="icon-btn h-10 w-10 text-ink-500 hover:text-danger" aria-label={`Remove ${item.name} from bag`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {full && item.compareAtPrice && item.compareAtPrice > item.unitPrice && (
          <p className="mt-2 text-xs font-medium text-accent-dark">You save {formatPrice((item.compareAtPrice - item.unitPrice) * item.quantity)}</p>
        )}
        {!blocked && item.quantity >= item.maxStock && item.maxStock <= 5 && <p className="mt-2 text-xs text-warning">Only {item.maxStock} available in this size</p>}
      </div>
    </li>
  );
}
