import { ShoppingBag } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ButtonLink, EmptyState, ErrorState, InlineAlert, PageLoader } from '@/components/common';
import { CartIssuesAlert } from '@/components/cart';
import { CheckoutSteps, InformationStep, MobileOrderSummary, OrderSummaryPanel, PaymentStep, ShippingStep } from '@/components/checkout';
import { ROUTES, confirmationPath } from '@/constants/routes';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { usePageMeta } from '@/hooks/usePageMeta';
import { errorMessage } from '@/services';
import { ApiError, api, newIdempotencyKey } from '@/services/api';
import { orderService, toApiPaymentMethod, type CheckoutValidateInput } from '@/services/orderService';
import { paymentService } from '@/services/paymentService';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useCheckoutStore } from '@/store/checkoutStore';
import type { Address, CardDetails, CartItem, CheckoutStep, CheckoutValidation, Order, PlaceOrderInput, User } from '@/types';

const STEP_INDEX: Record<CheckoutStep, number> = { information: 0, shipping: 1, payment: 2 };
const isOnline = (m: string | null | undefined) => m === 'card' || m === 'mobile-money';

/** Checkout requires an account: the order is placed from the signed-in customer's server cart. */
export default function CheckoutPage() {
  usePageMeta({ title: 'Checkout', noindex: true });
  const { user } = useAuth();
  const authStatus = useAuthStore((s) => s.status);
  if (authStatus === 'restoring') return <PageLoader />;
  if (!user) return <Navigate to={`${ROUTES.login}?redirect=${encodeURIComponent(ROUTES.checkout)}`} replace />;
  return <CheckoutFlow user={user} />;
}

function CheckoutFlow({ user }: { user: User }) {
  const navigate = useNavigate();
  const cart = useCart();
  const checkout = useCheckoutStore();
  const [validation, setValidation] = useState<CheckoutValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placingText, setPlacingText] = useState('Placing order…');
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [restoringPending, setRestoringPending] = useState(Boolean(checkout.pendingOrderId));
  const placingRef = useRef(false);
  const placedRef = useRef(false);
  const payKeyRef = useRef<string | null>(null);

  // Saved addresses (read-only here; managed in the account area).
  const addresses = useAsync(() => api.get<Address[]>('/addresses'), [user.id]);

  // Latest server cart on entry (the guest bag was merged on sign-in).
  useEffect(() => {
    void cart.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill contact details from the account.
  useEffect(() => {
    if (!checkout.contact.email || checkout.contact.email !== user.email) {
      checkout.setContact({
        firstName: checkout.contact.firstName || user.firstName,
        lastName: checkout.contact.lastName || user.lastName,
        email: user.email,
        phone: checkout.contact.phone || user.phone || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Default saved address.
  useEffect(() => {
    const def = addresses.data?.find((a) => a.isDefault) ?? addresses.data?.[0];
    if (def && !checkout.addressId && !checkout.address.line1) {
      checkout.setAddressId(def.id);
      checkout.setAddress({ line1: def.line1, line2: def.line2 ?? '', district: def.district ?? '', city: def.city, country: def.country, postalCode: def.postalCode ?? '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.data]);

  // An order from this attempt is awaiting payment (e.g. declined card, then page reload).
  useEffect(() => {
    const id = checkout.pendingOrderId;
    if (!id) return;
    orderService
      .getById(id)
      .then((order) => {
        if (!order) return checkout.setPendingOrder(null);
        if (order.paymentStatus === 'paid' || !isOnline(order.payment.method) || order.status !== 'payment-pending') {
          placedRef.current = true;
          checkout.reset();
          navigate(confirmationPath(order.id), { replace: true });
          return;
        }
        setPendingOrder(order);
        checkout.setPaymentMethod(order.payment.method);
        checkout.setStep('payment');
      })
      .catch(() => undefined)
      .finally(() => setRestoringPending(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Server-side validation: re-run whenever the bag, coupon, address or shipping method changes ──
  const addressInput = useMemo<Pick<CheckoutValidateInput, 'addressId' | 'address'>>(() => {
    if (checkout.addressId) return { addressId: checkout.addressId };
    if (checkout.address.line1.trim().length >= 3) {
      return {
        address: {
          firstName: checkout.contact.firstName,
          lastName: checkout.contact.lastName,
          phone: checkout.contact.phone,
          addressLine1: checkout.address.line1.trim(),
          addressLine2: checkout.address.line2.trim() || null,
          district: checkout.address.district?.trim() || null,
          city: checkout.address.city,
          country: checkout.address.country,
          postalCode: checkout.address.postalCode.trim() || null,
        },
      };
    }
    return checkout.address.city ? { address: { city: checkout.address.city } } : {};
  }, [checkout.addressId, checkout.address, checkout.contact]);

  const server = useCartStore((s) => s.server);
  const validateKey = JSON.stringify({ m: checkout.shippingMethod, a: addressInput, c: server?.coupon?.code ?? null, i: server?.items.map((i) => `${i.variantId}:${i.quantity}`) });
  const validateReq = useRef(0);

  const runValidation = useCallback(async () => {
    if (checkout.pendingOrderId) return;
    const id = ++validateReq.current;
    setValidating(true);
    try {
      const v = await orderService.validateCheckout({ shippingMethod: checkout.shippingMethod || undefined, ...addressInput });
      if (id !== validateReq.current) return;
      setValidation(v);
      setValidateError(null);
    } catch (err) {
      if (id !== validateReq.current) return;
      setValidateError(errorMessage(err, 'We couldn’t check your order. Please try again.'));
    } finally {
      if (id === validateReq.current) setValidating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validateKey, checkout.pendingOrderId]);

  useEffect(() => {
    if (!server || cart.syncing) return;
    const t = window.setTimeout(() => void runValidation(), 250);
    return () => window.clearTimeout(t);
  }, [runValidation, server, cart.syncing]);

  // Default / fix the shipping method from the server's options.
  useEffect(() => {
    const options = validation?.shippingOptions;
    if (!options?.length) return;
    if (!options.some((o) => o.code === checkout.shippingMethod)) checkout.setShippingMethod(options[0].code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validation?.shippingOptions]);

  // Default / fix the payment method from what the API offers.
  useEffect(() => {
    const methods = validation?.paymentMethods;
    if (!methods?.length || pendingOrder) return;
    if (!methods.some((m) => m.type === checkout.paymentMethod)) checkout.setPaymentMethod(methods[0].type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validation?.paymentMethods, pendingOrder]);

  const goTo = (step: CheckoutStep) => {
    checkout.setStep(step);
    setPlaceError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const finish = (order: Order) => {
    placedRef.current = true;
    navigate(confirmationPath(order.id), { replace: true, state: { justPlaced: true } });
    // The API emptied the server cart when the order was created; drop any device copy too.
    cart.clearLocal();
    void cart.refresh();
    checkout.reset();
  };

  const buildOrderInput = (): PlaceOrderInput => {
    const option = validation?.shippingOptions.find((o) => o.code === checkout.shippingMethod);
    const needsAddress = option?.requiresAddress ?? true;
    const input: PlaceOrderInput = {
      shippingMethod: checkout.shippingMethod,
      paymentMethod: toApiPaymentMethod(checkout.paymentMethod!),
      couponCode: server?.coupon?.code ?? null,
      customerNote: checkout.customerNote || null,
    };
    if (checkout.addressId) input.addressId = checkout.addressId;
    else if (needsAddress || checkout.address.line1.trim()) {
      const a = addressInput.address;
      if (a?.addressLine1) input.address = { ...(a as NonNullable<PlaceOrderInput['address']>) };
    }
    return input;
  };

  const placeOrder = async (details: { card?: CardDetails; phone?: string }) => {
    if (placingRef.current || !checkout.paymentMethod) return;
    placingRef.current = true;
    setPlacing(true);
    setPlaceError(null);
    try {
      let order = pendingOrder;
      if (!order) {
        setPlacingText('Placing order…');
        // Same key for retries / double clicks of this attempt → the API returns the same order.
        order = await orderService.create(buildOrderInput(), checkout.ensureAttemptKey());
        if (isOnline(order.payment.method) && order.paymentStatus !== 'paid') {
          checkout.setPendingOrder(order.id);
          setPendingOrder(order);
        }
      }
      if (isOnline(order.payment.method) && order.paymentStatus !== 'paid') {
        setPlacingText('Processing payment…');
        payKeyRef.current ??= newIdempotencyKey();
        try {
          order = await paymentService.payOrder(order.id, { method: order.payment.method, card: details.card, phone: details.phone }, payKeyRef.current);
        } finally {
          payKeyRef.current = null;
        }
      }
      finish(order);
    } catch (err) {
      const message = errorMessage(err, 'We couldn’t place your order. Please try again.');
      if (checkout.pendingOrderId) {
        setPlaceError(`${message} Your order is saved — you can retry the payment now.`);
      } else {
        setPlaceError(message);
        // Stock / price / coupon changed since the last check → show the server's view.
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          void cart.refresh();
          void runValidation();
        }
      }
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  };

  // ── Render ──
  if (restoringPending || (cart.syncing && !cart.items.length)) return <PageLoader />;

  if (cart.syncError && !server && !pendingOrder) {
    return (
      <div className="container-site py-10">
        <ErrorState message={cart.syncError} onRetry={() => void cart.refresh()} />
      </div>
    );
  }

  if (!cart.items.length && !pendingOrder && !placedRef.current) {
    return (
      <div className="container-site py-10">
        <EmptyState
          icon={<ShoppingBag />}
          title="Your bag is empty"
          description={cart.issues.length ? 'The items in your bag are no longer available.' : 'Add products to your bag to check out.'}
          action={
            <ButtonLink to={ROUTES.shop} variant="primary">
              Continue shopping
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const summaryItems: CartItem[] = pendingOrder
    ? pendingOrder.items.map((i) => ({ ...i, id: i.id, maxStock: i.quantity, brand: i.brand ?? '' }))
    : cart.items;
  const totals = pendingOrder
    ? {
        ...cart.totals,
        subtotal: pendingOrder.subtotal,
        productDiscount: pendingOrder.productDiscount,
        discount: pendingOrder.discount,
        shipping: pendingOrder.shippingCost,
        tax: pendingOrder.tax,
        total: pendingOrder.total,
        estimated: false,
      }
    : (validation?.totals ?? cart.totals);
  const coupon = pendingOrder ? (pendingOrder.couponCode ? { code: pendingOrder.couponCode, description: '', type: 'fixed', value: 0 } : null) : (validation?.coupon ?? cart.coupon);
  const shippingKnown = Boolean(pendingOrder || validation?.shipping);
  const shippingLabel = pendingOrder?.shipping.method.name ?? validation?.shipping?.name ?? 'Shipping';
  const issues = pendingOrder ? [] : [...(validation?.issues ?? []), ...cart.issues];
  const blockingProblems = (validation?.problems ?? []).filter((p) => p.field !== 'shippingMethod' || checkout.step !== 'information');
  const stepProblems = blockingProblems.filter((p) => p.field === 'address' || p.field === 'shippingMethod').map((p) => p.message);
  const otherProblems = blockingProblems.filter((p) => p.field !== 'address' && p.field !== 'shippingMethod').map((p) => p.message);

  const summaryProps = {
    items: summaryItems,
    totals,
    coupon,
    onApplyCoupon: cart.applyCoupon,
    onRemoveCoupon: cart.removeCoupon,
    shippingKnown,
    shippingLabel,
    updating: validating || cart.pending,
    lockCoupon: Boolean(pendingOrder),
  };

  return (
    <>
      <MobileOrderSummary {...summaryProps} />
      <div className="container-site py-8 sm:py-12">
        <h1 className="sr-only">Checkout</h1>
        <div className="grid gap-10 lg:grid-cols-[1fr_420px] lg:gap-12 xl:grid-cols-[1fr_460px] xl:gap-16">
          <div className="min-w-0">
            <div className="mb-8">
              <CheckoutSteps current={STEP_INDEX[checkout.step]} onStepClick={pendingOrder ? undefined : (i) => goTo((['information', 'shipping', 'payment'] as const)[i])} />
            </div>

            <CartIssuesAlert issues={issues} className="mb-6" />
            {pendingOrder && (
              <InlineAlert tone="warning" className="mb-6">
                Order <strong className="font-semibold">{pendingOrder.number}</strong> is reserved and awaiting payment. Complete the payment below to confirm it.
              </InlineAlert>
            )}
            {validateError && (
              <InlineAlert tone="error" className="mb-6">
                {validateError}{' '}
                <button type="button" className="font-semibold underline" onClick={() => void runValidation()}>
                  Retry
                </button>
              </InlineAlert>
            )}
            {!pendingOrder && otherProblems.length > 0 && checkout.step === 'payment' && (
              <InlineAlert tone="error" className="mb-6">
                {otherProblems.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </InlineAlert>
            )}

            <div key={checkout.step} className="animate-fade-up">
              {checkout.step === 'information' && (
                <InformationStep
                  initial={checkout.contact}
                  signedIn
                  onSubmit={(contact) => {
                    checkout.setContact(contact);
                    goTo('shipping');
                  }}
                />
              )}
              {checkout.step === 'shipping' && (
                <ShippingStep
                  initial={checkout.address}
                  initialAddressId={checkout.addressId}
                  initialNote={checkout.customerNote}
                  method={checkout.shippingMethod}
                  options={validation?.shippingOptions}
                  savedAddresses={addresses.data ?? []}
                  addressesLoading={addresses.loading}
                  problems={stepProblems}
                  onMethodChange={checkout.setShippingMethod}
                  onBack={() => goTo('information')}
                  onSubmit={(address, addressId, method, note) => {
                    checkout.setAddress(address);
                    checkout.setAddressId(addressId);
                    checkout.setShippingMethod(method);
                    checkout.setCustomerNote(note);
                    goTo('payment');
                  }}
                />
              )}
              {checkout.step === 'payment' && (
                <PaymentStep
                  methods={pendingOrder ? (validation?.paymentMethods ?? []).filter((m) => m.type === pendingOrder.payment.method).concat(validation ? [] : [{ method: toApiPaymentMethod(pendingOrder.payment.method), type: pendingOrder.payment.method, provider: pendingOrder.payment.provider ?? '', label: '' }]) : (validation?.paymentMethods ?? [])}
                  method={pendingOrder ? pendingOrder.payment.method : checkout.paymentMethod}
                  onMethod={checkout.setPaymentMethod}
                  total={totals.total}
                  defaultPhone={checkout.contact.phone}
                  placing={placing}
                  placingText={placingText}
                  error={placeError}
                  isTest={pendingOrder ? pendingOrder.payment.provider === 'mock' : paymentService.isTestProvider(validation?.paymentMethods ?? [])}
                  lockedMethod={Boolean(pendingOrder)}
                  canPlace={Boolean(pendingOrder) || (Boolean(validation?.valid) && !validating && !cart.pending)}
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
