import { ArrowRight, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, ButtonLink, Drawer, EmptyState, Spinner } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { useCart } from '@/hooks/useCart';
import { useUiStore } from '@/store/uiStore';
import { formatPrice, pluralize } from '@/utils/format';
import { CartIssuesAlert } from './CartIssues';
import { CartLineItem } from './CartLineItem';
import { FreeShippingMeter } from './FreeShippingMeter';

export function CartDrawer() {
  const open = useUiStore((s) => s.overlay === 'cart');
  const close = useUiStore((s) => s.close);
  const { items, totals, count, setQuantity, remove, syncing, pending, issues, dismissIssues } = useCart();
  const navigate = useNavigate();

  const go = (path: string) => {
    close();
    navigate(path);
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Your Bag"
      headerExtra={count > 0 ? <span className="text-sm text-ink-500">({pluralize(count, 'item')})</span> : undefined}
      footer={
        items.length > 0 && (
          <div className="space-y-4 p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold uppercase tracking-[0.1em]">{totals.estimated ? 'Subtotal' : 'Bag total'}</span>
              <span className="text-lg font-semibold tabular-nums">{formatPrice(totals.estimated ? totals.subtotal : totals.total)}</span>
            </div>
            <p className="-mt-2 text-xs text-ink-500">{totals.estimated ? 'Shipping, promo codes and final prices confirmed at checkout.' : 'Shipping calculated at checkout.'}</p>
            <Button variant="primary" size="lg" fullWidth onClick={() => go(ROUTES.checkout)} rightIcon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}>
              Proceed to checkout
            </Button>
            <Button variant="outline" fullWidth onClick={() => go(ROUTES.cart)}>
              View bag
            </Button>
          </div>
        )
      }
    >
      {syncing && items.length === 0 ? (
        <div className="flex justify-center py-16" aria-busy="true">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={<ShoppingBag />}
          title="Your bag is empty"
          description="Gear up with the latest performance footwear, apparel and equipment."
          action={
            <ButtonLink to={ROUTES.shop} onClick={close} variant="primary">
              Start shopping
            </ButtonLink>
          }
          className="px-6"
        />
      ) : (
        <div className="px-5">
          <div className="border-b border-paper-200 py-5">
            <FreeShippingMeter remaining={totals.freeShippingRemaining} threshold={totals.freeShippingThreshold} />
          </div>
          <CartIssuesAlert issues={issues} onDismiss={dismissIssues} className="mt-4" />
          <ul className="divide-y divide-paper-200">
            {items.map((item) => (
              <CartLineItem key={item.id} item={item} busy={pending} onQuantity={(q) => setQuantity(item.id, q)} onRemove={() => remove(item.id)} onNavigate={close} />
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  );
}
