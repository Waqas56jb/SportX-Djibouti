import { Banknote, Building2, CreditCard, Info, Lock, Smartphone } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, Checkbox, InlineAlert, SelectField, Skeleton, TextAreaField, TextField } from '@/components/common';
import { COUNTRIES, DJIBOUTI_CITIES } from '@/constants/commerce';
import { ROUTES } from '@/constants/routes';
import type { Address, CardDetails, CheckoutAddress, CheckoutContact, PaymentMethodOption, PaymentMethodType, ShippingOption } from '@/types';
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
          <TextField
            id="co-email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={set('email')}
            error={errors.email}
            readOnly={signedIn}
            hint={signedIn ? 'Order updates go to your account email.' : 'Your order confirmation will be sent here.'}
          />
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

const etaLabel = (o: ShippingOption) =>
  !o.maxDays ? null : o.minDays === o.maxDays ? `Est. ${o.minDays} business day${o.minDays === 1 ? '' : 's'}` : `Est. ${o.minDays}–${o.maxDays} business days`;

interface ShippingStepProps {
  initial: CheckoutAddress;
  initialAddressId: string | null;
  /** Selected method code. */
  method: string;
  /** Options quoted by the server (`POST /checkout/validate`); undefined while loading. */
  options: ShippingOption[] | undefined;
  savedAddresses: Address[];
  addressesLoading?: boolean;
  /** Server problems for this step (address / shipping). */
  problems: string[];
  onMethodChange: (code: string) => void;
  onBack: () => void;
  onSubmit: (address: CheckoutAddress, addressId: string | null, method: string, note: string) => void;
  initialNote: string;
}

export function ShippingStep({ initial, initialAddressId, method, options, savedAddresses, addressesLoading, problems, onMethodChange, onBack, onSubmit, initialNote }: ShippingStepProps) {
  const [values, setValues] = useState(initial);
  const [addressId, setAddressId] = useState<string | null>(initialAddressId);
  const [note, setNote] = useState(initialNote);
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutAddress | 'method', string>>>({});
  const selected = options?.find((o) => o.code === method);
  const needsAddress = selected ? selected.requiresAddress : true;

  const set = (k: keyof CheckoutAddress) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setAddressId(null); // edited by hand → a new address
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const applySaved = (a: Address) => {
    setAddressId(a.id);
    setErrors({});
    setValues({ line1: a.line1, line2: a.line2 ?? '', district: a.district ?? '', city: a.city, country: a.country, postalCode: a.postalCode ?? '' });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Partial<Record<keyof CheckoutAddress | 'method', string>> = {};
    if (!method || !selected) errs.method = 'Choose a delivery method';
    if (needsAddress && !addressId) {
      Object.assign(
        errs,
        validate(values, {
          line1: (v: string) => (v.trim().length < 3 ? 'Enter your street address' : undefined),
          city: required('Select a city'),
        }),
      );
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit(values, addressId, method, note.trim());
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <StepCard title="Delivery method">
        <fieldset>
          <legend className="sr-only">Choose a delivery method</legend>
          {!options ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading delivery options">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : options.length === 0 ? (
            <InlineAlert tone="warning">No delivery options are available for this address right now. Please try another city or contact us.</InlineAlert>
          ) : (
            <div className="space-y-3">
              {options.map((m) => (
                <label
                  key={m.code}
                  className={cn('flex cursor-pointer items-start gap-4 border p-4 transition-colors sm:p-5', method === m.code ? 'border-ink bg-paper-50' : 'border-paper-300 hover:border-ink/50')}
                >
                  <input
                    type="radio"
                    name="shipping-method"
                    value={m.code}
                    checked={method === m.code}
                    onChange={() => {
                      onMethodChange(m.code);
                      setErrors((x) => ({ ...x, method: undefined }));
                    }}
                    className="mt-1 h-4 w-4 accent-ink"
                  />
                  <span className="flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{m.name}</span>
                      <span className="text-sm font-semibold tabular-nums">{m.isFree || m.fee === 0 ? <span className="text-success">Free</span> : formatPrice(m.fee)}</span>
                    </span>
                    {m.description && <span className="mt-1 block text-sm text-ink-500">{m.description}</span>}
                    {etaLabel(m) && <span className="mt-1 block text-xs text-ink-500">{etaLabel(m)}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
          {errors.method && <p className="field-error">{errors.method}</p>}
        </fieldset>
      </StepCard>

      <StepCard title={needsAddress ? 'Shipping address' : 'Collection details'}>
        {!needsAddress && (
          <InlineAlert className="mb-5">
            {selected?.description || 'Your order will be ready to collect from our store.'} We’ll contact you when it’s ready. No address needed.
          </InlineAlert>
        )}
        {needsAddress && (
          <>
            {addressesLoading ? (
              <Skeleton className="mb-6 h-14 w-full" />
            ) : (
              savedAddresses.length > 0 && (
                <div className="mb-6">
                  <p className="label">Saved addresses</p>
                  <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
                    {savedAddresses.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => applySaved(a)}
                        aria-pressed={addressId === a.id}
                        className={cn('min-h-[44px] shrink-0 border px-4 py-2 text-left text-sm transition-colors', addressId === a.id ? 'border-ink bg-paper-50' : 'border-paper-300 hover:border-ink')}
                      >
                        <span className="block font-semibold">
                          {a.label || `${a.firstName} ${a.lastName}`}
                          {a.isDefault && <span className="ml-2 text-2xs font-normal uppercase tracking-[0.12em] text-ink-500">Default</span>}
                        </span>
                        <span className="block text-xs text-ink-500">
                          {a.line1}, {a.city}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Address" autoComplete="address-line1" value={values.line1} onChange={set('line1')} error={errors.line1} containerClassName="sm:col-span-2" />
              <TextField label="Apartment, building, landmark" autoComplete="address-line2" value={values.line2} onChange={set('line2')} optional containerClassName="sm:col-span-2" />
              <TextField label="District / quarter" value={values.district ?? ''} onChange={set('district')} optional />
              <SelectField label="City" value={values.city} onChange={set('city')} error={errors.city} options={DJIBOUTI_CITIES.map((c) => ({ value: c, label: c }))} />
              <SelectField label="Country" value={values.country} onChange={set('country')} options={COUNTRIES.map((c) => ({ value: c.name, label: c.name }))} hint="We currently deliver within Djibouti." />
              <TextField label="Postal code" autoComplete="postal-code" value={values.postalCode} onChange={set('postalCode')} optional />
            </div>
          </>
        )}
        <TextAreaField
          label="Order note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          optional
          maxLength={500}
          hint="Delivery instructions or anything we should know."
          containerClassName="mt-5"
        />
      </StepCard>

      {problems.length > 0 && (
        <InlineAlert tone="error">
          {problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </InlineAlert>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back to information
        </Button>
        <Button type="submit" variant="primary" size="lg" disabled={!options}>
          Continue to payment
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────────── Payment ─────────────────────────────

const METHOD_UI: Record<PaymentMethodType, { label: string; description: string; icon: typeof CreditCard }> = {
  card: { label: 'Credit / Debit card', description: 'Visa, Mastercard and other major cards', icon: CreditCard },
  'mobile-money': { label: 'Mobile money', description: 'Pay from your mobile wallet', icon: Smartphone },
  'cash-on-delivery': { label: 'Cash on delivery', description: 'Pay when your order arrives', icon: Banknote },
  'bank-transfer': { label: 'Bank transfer', description: 'We’ll send transfer details by email', icon: Building2 },
};

export interface PaymentFieldValues {
  card: CardDetails;
  wallet: string;
}

/** Card / wallet inputs. UI-only: values stay in component memory and are never sent to SPORTX. */
export function PaymentFields({
  method,
  values,
  onChange,
  errors,
  total,
}: {
  method: PaymentMethodType;
  values: PaymentFieldValues;
  onChange: (v: PaymentFieldValues) => void;
  errors: Record<string, string | undefined>;
  total: number;
}) {
  const setCard = (patch: Partial<CardDetails>) => onChange({ ...values, card: { ...values.card, ...patch } });
  if (method === 'card') {
    return (
      <div className="grid animate-fade-in gap-5 sm:grid-cols-2">
        <TextField label="Name on card" autoComplete="cc-name" value={values.card.name} onChange={(e) => setCard({ name: e.target.value })} error={errors.name} containerClassName="sm:col-span-2" />
        <TextField
          label="Card number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="1234 5678 9012 3456"
          value={values.card.number}
          onChange={(e) => setCard({ number: formatCardNumber(e.target.value) })}
          error={errors.number}
          containerClassName="sm:col-span-2"
          rightSlot={<CreditCard className="h-4 w-4 text-ink-500" aria-hidden />}
        />
        <TextField label="Expiry" inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" value={values.card.expiry} onChange={(e) => setCard({ expiry: formatExpiry(e.target.value) })} error={errors.expiry} />
        <TextField label="CVC" inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} value={values.card.cvc} onChange={(e) => setCard({ cvc: e.target.value.replace(/\D/g, '') })} error={errors.cvc} />
      </div>
    );
  }
  if (method === 'mobile-money') {
    return (
      <div className="animate-fade-in">
        <TextField
          label="Mobile wallet number"
          type="tel"
          inputMode="tel"
          placeholder="+253"
          value={values.wallet}
          onChange={(e) => onChange({ ...values, wallet: e.target.value })}
          error={errors.wallet}
          hint="You’ll receive a prompt on your phone to approve the payment."
        />
      </div>
    );
  }
  if (method === 'cash-on-delivery') {
    return <InlineAlert className="animate-fade-in">Pay {formatPrice(total)} in cash when your order is delivered or collected. Please have the exact amount ready.</InlineAlert>;
  }
  return <InlineAlert className="animate-fade-in">We’ll email you the bank details. Your order ships once the transfer is received.</InlineAlert>;
}

/** Validates the storefront form for the chosen method. Returns only the failing fields. */
export function validatePaymentFields(method: PaymentMethodType, values: PaymentFieldValues): Record<string, string> {
  const errs: Record<string, string | undefined> = {};
  if (method === 'card') {
    if (!values.card.name.trim()) errs.name = 'Enter the name on the card';
    if (!luhn(values.card.number)) errs.number = 'Enter a valid card number';
    errs.expiry = cardExpiry(values.card.expiry);
    if (!/^\d{3,4}$/.test(values.card.cvc)) errs.cvc = 'Enter the 3–4 digit code';
  }
  if (method === 'mobile-money') errs.wallet = phone(values.wallet);
  return Object.fromEntries(Object.entries(errs).filter(([, v]) => v)) as Record<string, string>;
}

export function TestPaymentNotice() {
  return (
    <InlineAlert className="mb-6">
      <span className="flex gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Test payments — no money is taken. Use card <strong className="font-semibold">4242 4242 4242 4242</strong> with any future expiry and CVC. A card ending in{' '}
          <strong className="font-semibold">0002</strong> (e.g. 4000 0000 0000 0002) simulates a decline.
        </span>
      </span>
    </InlineAlert>
  );
}

export const emptyPaymentFields = (phoneNumber = ''): PaymentFieldValues => ({ card: { name: '', number: '', expiry: '', cvc: '' }, wallet: phoneNumber });

interface PaymentStepProps {
  /** Methods the API offers for this checkout. */
  methods: PaymentMethodOption[];
  method: PaymentMethodType | null;
  onMethod: (m: PaymentMethodType) => void;
  total: number;
  defaultPhone: string;
  placing: boolean;
  placingText: string;
  error: string | null;
  isTest: boolean;
  /** An order was already created in this attempt — only its payment can be retried. */
  lockedMethod?: boolean;
  /** False while the server says checkout is not valid (issues / problems). */
  canPlace: boolean;
  onBack: () => void;
  onPlace: (details: { card?: CardDetails; phone?: string }) => void;
}

export function PaymentStep({ methods, method, onMethod, total, defaultPhone, placing, placingText, error, isTest, lockedMethod, canPlace, onBack, onPlace }: PaymentStepProps) {
  // Card details exist only in this component's memory — never persisted, never sent to the API.
  const [fields, setFields] = useState<PaymentFieldValues>(() => emptyPaymentFields(defaultPhone));
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!method) return setErrors({ method: 'Choose a payment method' });
    const errs: Record<string, string | undefined> = { ...validatePaymentFields(method, fields) };
    if (!agree) errs.agree = 'Please accept the terms to continue';
    const clean = Object.fromEntries(Object.entries(errs).filter(([, v]) => v));
    setErrors(clean);
    if (Object.keys(clean).length) return;
    onPlace(method === 'card' ? { card: fields.card } : method === 'mobile-money' ? { phone: fields.wallet } : {});
  };

  const visible = lockedMethod && method ? methods.filter((m) => m.type === method) : methods;
  const isOnline = method === 'card' || method === 'mobile-money';

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
        {isTest && isOnline && <TestPaymentNotice />}
        {methods.length === 0 ? (
          <InlineAlert tone="warning">Online payment is temporarily unavailable. Please try again shortly or contact us.</InlineAlert>
        ) : (
          <fieldset>
            <legend className="sr-only">Payment method</legend>
            <div className={cn('grid gap-3', visible.length >= 3 ? 'sm:grid-cols-3' : visible.length === 2 ? 'sm:grid-cols-2' : '')}>
              {visible.map((m) => {
                const ui = METHOD_UI[m.type] ?? METHOD_UI.card;
                const Icon = ui.icon;
                return (
                  <label key={m.method} className={cn('flex cursor-pointer flex-col gap-3 border p-4 transition-colors', method === m.type ? 'border-ink bg-paper-50' : 'border-paper-300 hover:border-ink/50')}>
                    <span className="flex items-center justify-between">
                      <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                      <input
                        type="radio"
                        name="payment-method"
                        value={m.type}
                        checked={method === m.type}
                        disabled={lockedMethod}
                        onChange={() => {
                          onMethod(m.type);
                          setErrors({});
                        }}
                        className="h-4 w-4 accent-ink"
                      />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{ui.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-500">{ui.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.method && <p className="field-error">{errors.method}</p>}
          </fieldset>
        )}

        {method && (
          <div className="mt-6">
            <PaymentFields method={method} values={fields} onChange={setFields} errors={errors} total={total} />
          </div>
        )}
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
        <Button variant="ghost" onClick={onBack} disabled={placing || lockedMethod}>
          Back to shipping
        </Button>
        <Button type="submit" variant="primary" size="lg" loading={placing} loadingText={placingText} disabled={!canPlace || methods.length === 0} leftIcon={<Lock className="h-4 w-4" />}>
          {lockedMethod ? 'Retry payment' : 'Place order'} · {formatPrice(total)}
        </Button>
      </div>
    </form>
  );
}
