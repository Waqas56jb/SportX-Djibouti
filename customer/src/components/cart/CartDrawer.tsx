import { ArrowRight, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, ButtonLink, Drawer, EmptyState } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { useCart } from '@/hooks/useCart';
import { useUiStore } from '@/store/uiStore';
import { formatPrice, pluralize } from '@/utils/format';
import { CartLineItem } from './CartLineItem';
import { FreeShippingMeter } from './FreeShippingMeter';

export function CartDrawer() {
  const open = useUiStore((s) => s.overlay === 'cart');
  const close = useUiStore((s) => s.close);
  const { items, totals, count, setQuantity, remove } = useCart();
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
              <span className="text-sm font-semibold uppercase tracking-[0.1em]">Subtotal</span>
              <span className="text-lg font-semibold tabular-nums">{formatPrice(totals.subtotal)}</span>
            </div>
            <p className="-mt-2 text-xs text-ink-500">Shipping and discounts calculated at checkout.</p>
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
      {items.length === 0 ? (
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
            <FreeShippingMeter remaining={totals.freeShippingRemaining} />
          </div>
          <ul className="divide-y divide-paper-200">
            {items.map((item) => (
              <CartLineItem key={item.id} item={item} onQuantity={(q) => setQuantity(item.id, q)} onRemove={() => remove(item.id)} onNavigate={close} />
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  );
}
