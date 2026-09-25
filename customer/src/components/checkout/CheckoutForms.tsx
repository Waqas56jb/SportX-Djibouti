import { Banknote, CreditCard, Info, Lock, Smartphone } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, Checkbox, InlineAlert, SelectField, TextField } from '@/components/common';
import { COUNTRIES, DJIBOUTI_CITIES, FREE_SHIPPING_THRESHOLD, SHIPPING_METHODS } from '@/constants/commerce';
import { ROUTES } from '@/constants/routes';
import type { Address, CardDetails, CheckoutAddress, CheckoutContact, PaymentMethodType } from '@/types';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format';
import { cardExpiry, email, formatCardNumber, formatExpiry, luhn, phone, required, validate } from '@/utils/validation';

function StepCard({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border border-paper-200 bg-white p-5 sm:p-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="heading-md">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

// ───────────────────────────── Information ─────────────────────────────

export function InformationStep({ initial, signedIn, onSubmit }: { initial: CheckoutContact; signedIn: boolean; onSubmit: (v: CheckoutContact) => void }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutContact, string>>>({});
  const set = (k: keyof CheckoutContact) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(values, { firstName: required('Enter your first name'), lastName: required('Enter your last name'), email, phone });
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`co-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    onSubmit(values);
  };

  return (
    <form onSubmit={submit} noValidate>
      <StepCard
        title="Contact information"
        aside={
          !signedIn && (
            <p className="text-sm text-ink-500">
              Have an account?{' '}
              <Link to={`${ROUTES.login}?redirect=${encodeURIComponent(ROUTES.checkout)}`} className="font-semibold text-ink underline underline-offset-4">
                Sign in
              </Link>
            </p>
          )
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="co-firstName" label="First name" autoComplete="given-name" value={values.firstName} onChange={set('firstName')} error={errors.firstName} />
          <TextField id="co-lastName" label="Last name" autoComplete="family-name" value={values.lastName} onChange={set('lastName')} error={errors.lastName} />
          <TextField id="co-email" label="Email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} hint="Your order confirmation will be sent here." />
          <TextField id="co-phone" label="Phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+253" value={values.phone} onChange={set('phone')} error={errors.phone} hint="For delivery updates." />
        </div>
      </StepCard>
      <div className="mt-6 flex justify-end">
        <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto">
          Continue to shipping
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────────── Shipping ─────────────────────────────

interface ShippingStepProps {
  initial: CheckoutAddress;
  methodId: string;
  subtotalAfterDiscount: number;
  savedAddresses: Address[];
  onBack: () => void;
  onSubmit: (address: CheckoutAddress, methodId: string) => void;
}

export function ShippingStep({ initial, methodId, subtotalAfterDiscount, savedAddresses, onBack, onSubmit }: ShippingStepProps) {
  const [values, setValues] = useState(initial);
  const [method, setMethod] = useState(methodId);
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutAddress, string>>>({});
  const pickup = method === 'pickup';
  const free = subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD;

  const set = (k: keyof CheckoutAddress) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const applySaved = (a: Address) =>
    setValues({ line1: a.line1, line2: a.line2 ?? '', city: a.city, country: a.country, postalCode: a.postalCode ?? '' });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = pickup ? {} : validate(values, { line1: required('Enter your street address'), city: required('Select a city') });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit(values, method);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <StepCard title="Delivery method">
        <fieldset>
          <legend className="sr-only">Choose a delivery method</legend>
          <div className="space-y-3">
            {SHIPPING_METHODS.map((m) => {
              const price = m.price === 0 || free ? 0 : m.price;
              return (
                <label
                  key={m.id}
                  className={cn('flex cursor-pointer items-start gap-4 border p-4 transition-colors sm:p-5', method === m.id ? 'border-ink bg-paper-50' : 'border-paper-300 hover:border-ink/50')}
                >
                  <input type="radio" name="shipping-method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-1 h-4 w-4 accent-ink" />
                  <span className="flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{m.name}</span>
                      <span className="text-sm font-semibold tabular-nums">{price === 0 ? <span className="text-success">Free</span> : formatPrice(price)}</span>
                    </span>
                    <span className="mt-1 block text-sm text-ink-500">{m.description}</span>
                    <span className="mt-1 block text-xs text-ink-500">
                      Est. {m.eta[0] === m.eta[1] ? `${m.eta[0]} business day` : `${m.eta[0]}–${m.eta[1]} business days`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </StepCard>

      <StepCard title={pickup ? 'Billing address' : 'Shipping address'}>
        {savedAddresses.length > 0 && (
          <div className="mb-6">
            <p className="label">Saved addresses</p>
            <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
              {savedAddresses.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => applySaved(a)}
                  className={cn('min-h-[44px] shrink-0 border px-4 py-2 text-left text-sm transition-colors', values.line1 === a.line1 ? 'border-ink bg-paper-50' : 'border-paper-300 hover:border-ink')}
                >
                  <span className="block font-semibold">{a.label}</span>
                  <span className="block text-xs text-ink-500">
                    {a.line1}, {a.city}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {pickup && <InlineAlert className="mb-5">Your order will be ready to collect at SPORTX, Place Menelik. We’ll contact you when it’s ready.</InlineAlert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Address" autoComplete="address-line1" value={values.line1} onChange={set('line1')} error={errors.line1} containerClassName="sm:col-span-2" optional={pickup} />
          <TextField label="Apartment, building, landmark" autoComplete="address-line2" value={values.line2} onChange={set('line2')} optional containerClassName="sm:col-span-2" />
          <SelectField label="City" value={values.city} onChange={set('city')} error={errors.city} options={DJIBOUTI_CITIES.map((c) => ({ value: c, label: c }))} />
          <SelectField label="Country" value={values.country} onChange={set('country')} options={COUNTRIES.map((c) => ({ value: c.name, label: c.name }))} hint="We currently deliver within Djibouti." />
          <TextField label="Postal code" autoComplete="postal-code" value={values.postalCode} onChange={set('postalCode')} optional />
        </div>
      </StepCard>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back to information
        </Button>
        <Button type="submit" variant="primary" size="lg">
          Continue to payment
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────────── Payment ─────────────────────────────

const METHODS: { id: PaymentMethodType; label: string; description: string; icon: typeof CreditCard }[] = [
  { id: 'card', label: 'Credit / Debit card', description: 'Visa, Mastercard and other major cards', icon: CreditCard },
  { id: 'mobile-money', label: 'Mobile money', description: 'Pay from your mobile wallet', icon: Smartphone },
  { id: 'cash-on-delivery', label: 'Cash on delivery', description: 'Pay when your order arrives', icon: Banknote },
];

interface PaymentStepProps {
  method: PaymentMethodType;
  onMethod: (m: PaymentMethodType) => void;
  total: number;
  defaultPhone: string;
  placing: boolean;
  error: string | null;
  isDemo: boolean;
  onBack: () => void;
  onPlace: (details: { card?: CardDetails; phone?: string }) => void;
}

export function PaymentStep({ method, onMethod, total, defaultPhone, placing, error, isDemo, onBack, onPlace }: PaymentStepProps) {
  // Card details exist only in this component's memory — never persisted.
  const [card, setCard] = useState<CardDetails>({ name: '', number: '', expiry: '', cvc: '' });
  const [wallet, setWallet] = useState(defaultPhone);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string | undefined> = {};
    if (method === 'card') {
      if (!card.name.trim()) errs.name = 'Enter the name on the card';
      if (!luhn(card.number)) errs.number = 'Enter a valid card number';
      errs.expiry = cardExpiry(card.expiry);
      if (!/^\d{3,4}$/.test(card.cvc)) errs.cvc = 'Enter the 3–4 digit code';
    }
    if (method === 'mobile-money') errs.wallet = phone(wallet);
    if (!agree) errs.agree = 'Please accept the terms to continue';
    const clean = Object.fromEntries(Object.entries(errs).filter(([, v]) => v));
    setErrors(clean);
    if (Object.keys(clean).length) return;
    onPlace(method === 'card' ? { card } : method === 'mobile-money' ? { phone: wallet } : {});
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <StepCard
        title="Payment"
        aside={
          <span className="flex items-center gap-1.5 text-xs text-ink-500">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Encrypted & secure
          </span>
        }
      >
        {isDemo && (
          <InlineAlert className="mb-6">
            <span className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Demo mode — no payment is taken. Use test card <strong className="font-semibold">4242 4242 4242 4242</strong> with any future expiry and CVC.
              </span>
            </span>
          </InlineAlert>
        )}
        <fieldset>
          <legend className="sr-only">Payment method</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {METHODS.map(({ id, label, description, icon: Icon }) => (
              <label key={id} className={cn('flex cursor-pointer flex-col gap-3 border p-4 transition-colors', method === id ? 'border-ink bg-paper-50' : 'border-paper-300 hover:border-ink/50')}>
                <span className="flex items-center justify-between">
                  <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                  <input type="radio" name="payment-method" value={id} checked={method === id} onChange={() => onMethod(id)} className="h-4 w-4 accent-ink" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="mt-0.5 block text-xs text-ink-500">{description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6">
          {method === 'card' && (
            <div className="grid animate-fade-in gap-5 sm:grid-cols-2">
              <TextField label="Name on card" autoComplete="cc-name" value={card.name} onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))} error={errors.name} containerClassName="sm:col-span-2" />
              <TextField
                label="Card number"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="1234 5678 9012 3456"
                value={card.number}
                onChange={(e) => setCard((c) => ({ ...c, number: formatCardNumber(e.target.value) }))}
                error={errors.number}
                containerClassName="sm:col-span-2"
                rightSlot={<CreditCard className="h-4 w-4 text-ink-500" aria-hidden />}
              />
              <TextField label="Expiry" inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" value={card.expiry} onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))} error={errors.expiry} />
              <TextField label="CVC" inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} value={card.cvc} onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value.replace(/\D/g, '') }))} error={errors.cvc} />
            </div>
          )}
          {method === 'mobile-money' && (
            <div className="animate-fade-in">
              <TextField label="Mobile wallet number" type="tel" inputMode="tel" placeholder="+253" value={wallet} onChange={(e) => setWallet(e.target.value)} error={errors.wallet} hint="You’ll receive a prompt on your phone to approve the payment." />
            </div>
          )}
          {method === 'cash-on-delivery' && (
            <InlineAlert className="animate-fade-in">Pay {formatPrice(total)} in cash when your order is delivered or collected. Please have the exact amount ready.</InlineAlert>
          )}
        </div>
      </StepCard>

      <div className="border border-paper-200 bg-white p-5 sm:p-6">
        <Checkbox
          checked={agree}
          onChange={(e) => {
            setAgree(e.target.checked);
            setErrors((x) => ({ ...x, agree: undefined }));
          }}
          label={
            <>
              I agree to the{' '}
              <Link to={ROUTES.terms} target="_blank" className="underline underline-offset-2">
                Terms
              </Link>{' '}
              and{' '}
              <Link to={ROUTES.privacy} target="_blank" className="underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </>
          }
        />
        {errors.agree && <p className="field-error">{errors.agree}</p>}
      </div>

      {error && <InlineAlert tone="error">{error}</InlineAlert>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBack} disabled={placing}>
          Back to shipping
        </Button>
        <Button type="submit" variant="primary" size="lg" loading={placing} loadingText="Placing order…" leftIcon={<Lock className="h-4 w-4" />}>
          Place order · {formatPrice(total)}
        </Button>
      </div>
    </form>
  );
}
