import { ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ButtonLink, EmptyState, InlineAlert, PageLoader } from '@/components/common';
import { CheckoutSteps, InformationStep, MobileOrderSummary, OrderSummaryPanel, PaymentStep, ShippingStep } from '@/components/checkout';
import { SHIPPING_METHODS } from '@/constants/commerce';
import { ROUTES, confirmationPath } from '@/constants/routes';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { usePageMeta } from '@/hooks/usePageMeta';
import { addressService, cartService, errorMessage, orderService, paymentService } from '@/services';
import { useCheckoutStore } from '@/store/checkoutStore';
import type { CardDetails, CartIssue, CheckoutStep } from '@/types';
import { calculateTotals } from '@/utils/cart';

const STEP_INDEX: Record<CheckoutStep, number> = { information: 0, shipping: 1, payment: 2 };

export default function CheckoutPage() {
  usePageMeta({ title: 'Checkout', noindex: true });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, coupon, setCoupon, reconcile, clear } = useCart();
  const checkout = useCheckoutStore();
  const [issues, setIssues] = useState<CartIssue[]>([]);
  const [validating, setValidating] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const placedRef = useRef(false);

  const addresses = useAsync(() => (user ? addressService.list(user.id) : Promise.resolve([])), [user?.id]);

  // Re-validate stock and prices when checkout begins.
  useEffect(() => {
    let active = true;
    if (!items.length) {
      setValidating(false);
      return;
    }
    cartService
      .validate(items)
      .then((found) => {
        if (!active) return;
        if (found.length) {
          reconcile(found);
          setIssues(found);
        }
      })
      .catch(() => undefined)
      .finally(() => active && setValidating(false));
    return () => {
      active = false;
    };
    // Validate once on entry; later edits happen through the bag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill contact details for signed-in customers.
  useEffect(() => {
    if (user && !checkout.contact.email) {
      checkout.setContact({ firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Prefill the default saved address.
  useEffect(() => {
    const def = addresses.data?.find((a) => a.isDefault);
    if (def && !checkout.address.line1) {
      checkout.setAddress({ line1: def.line1, line2: def.line2 ?? '', city: def.city, country: def.country, postalCode: def.postalCode ?? '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.data]);

  const method = SHIPPING_METHODS.find((m) => m.id === checkout.shippingMethodId) ?? SHIPPING_METHODS[0];
  const shippingKnown = STEP_INDEX[checkout.step] >= 2;
  const totals = useMemo(() => calculateTotals(items, coupon, method.price), [items, coupon, method.price]);

  const goTo = (step: CheckoutStep) => {
    checkout.setStep(step);
    setPlaceError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const placeOrder = async (details: { card?: CardDetails; phone?: string }) => {
    setPlacing(true);
    setPlaceError(null);
    try {
      const auth = await paymentService.authorize({ method: checkout.paymentMethod, amount: totals.total, card: details.card, phone: details.phone });
      const order = await orderService.create({
        items,
        coupon,
        userId: user?.id ?? null,
        contact: checkout.contact,
        address: checkout.address,
        shippingMethodId: checkout.shippingMethodId,
        paymentMethod: checkout.paymentMethod,
        paymentReference: auth.reference,
      });
      placedRef.current = true;
      navigate(confirmationPath(order.id), { replace: true, state: { justPlaced: true } });
      clear();
      checkout.reset();
    } catch (err) {
      setPlaceError(errorMessage(err, 'We couldn’t place your order. Please try again.'));
      setPlacing(false);
    }
  };

  if (validating) return <PageLoader />;

  if (!items.length && !placedRef.current) {
    return (
      <div className="container-site py-10">
        <EmptyState
          icon={<ShoppingBag />}
          title="Your bag is empty"
          description={issues.length ? 'The items in your bag are no longer available.' : 'Add products to your bag to check out.'}
          action={
            <ButtonLink to={ROUTES.shop} variant="primary">
              Continue shopping
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const summaryProps = { items, totals, coupon, onCoupon: setCoupon, shippingKnown, shippingLabel: shippingKnown ? method.name : 'Shipping' };

  return (
    <>
      <MobileOrderSummary {...summaryProps} />
      <div className="container-site py-8 sm:py-12">
        <h1 className="sr-only">Checkout</h1>
        <div className="grid gap-10 lg:grid-cols-[1fr_420px] lg:gap-12 xl:grid-cols-[1fr_460px] xl:gap-16">
          <div className="min-w-0">
            <div className="mb-8">
              <CheckoutSteps current={STEP_INDEX[checkout.step]} onStepClick={(i) => goTo((['information', 'shipping', 'payment'] as const)[i])} />
            </div>

            {issues.length > 0 && (
              <InlineAlert tone="warning" className="mb-6">
                <p className="font-semibold">We updated your bag</p>
                <ul className="mt-1 list-inside list-disc">
                  {issues.map((i) => (
                    <li key={i.itemId + i.type}>{i.message}</li>
                  ))}
                </ul>
              </InlineAlert>
            )}

            <div key={checkout.step} className="animate-fade-up">
              {checkout.step === 'information' && (
                <InformationStep
                  initial={checkout.contact}
                  signedIn={Boolean(user)}
                  onSubmit={(contact) => {
                    checkout.setContact(contact);
                    goTo('shipping');
                  }}
                />
              )}
              {checkout.step === 'shipping' && (
                <ShippingStep
                  initial={checkout.address}
                  methodId={checkout.shippingMethodId}
                  subtotalAfterDiscount={totals.subtotal - totals.discount}
                  savedAddresses={addresses.data ?? []}
                  onBack={() => goTo('information')}
                  onSubmit={(address, methodId) => {
                    checkout.setAddress(address);
                    checkout.setShippingMethod(methodId);
                    goTo('payment');
                  }}
                />
              )}
              {checkout.step === 'payment' && (
                <PaymentStep
                  method={checkout.paymentMethod}
                  onMethod={checkout.setPaymentMethod}
                  total={totals.total}
                  defaultPhone={checkout.contact.phone}
                  placing={placing}
                  error={placeError}
                  isDemo={paymentService.isDemo}
                  onBack={() => goTo('shipping')}
                  onPlace={placeOrder}
                />
              )}
            </div>
          </div>
          <OrderSummaryPanel {...summaryProps} />
        </div>
      </div>
    </>
  );
}
