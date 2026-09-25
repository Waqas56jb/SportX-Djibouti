import { Banknote, Building2, CreditCard, Info, Lock, Smartphone } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RichText } from '@/components/cart/RichText';
import { Button, Checkbox, InlineAlert, SelectField, Skeleton, TextAreaField, TextField } from '@/components/common';
import { COUNTRIES, DJIBOUTI_CITIES } from '@/constants/commerce';
import { ROUTES } from '@/constants/routes';
import { t, useT } from '@/i18n';
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
  const { t } = useT();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutContact, string>>>({});
  const set = (k: keyof CheckoutContact) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(values, { firstName: required(t('checkout.contact.errors.firstName')), lastName: required(t('checkout.contact.errors.lastName')), email, phone });
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
        title={t('checkout.contact.title')}
        aside={
          !signedIn && (
            <p className="text-sm text-ink-500">
              {t('checkout.contact.haveAccount')}{' '}
              <Link to={`${ROUTES.login}?redirect=${encodeURIComponent(ROUTES.checkout)}`} className="font-semibold text-ink underline underline-offset-4">
                {t('common.actions.signIn')}
              </Link>
            </p>
          )
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="co-firstName" label={t('checkout.contact.firstName')} autoComplete="given-name" value={values.firstName} onChange={set('firstName')} error={errors.firstName} />
          <TextField id="co-lastName" label={t('checkout.contact.lastName')} autoComplete="family-name" value={values.lastName} onChange={set('lastName')} error={errors.lastName} />
          <TextField
            id="co-email"
            label={t('checkout.contact.email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={set('email')}
            error={errors.email}
            readOnly={signedIn}
            hint={signedIn ? t('checkout.contact.emailHintAccount') : t('checkout.contact.emailHintGuest')}
            className="ltr-text"
          />
          <TextField id="co-phone" label={t('checkout.contact.phone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="+253" value={values.phone} onChange={set('phone')} error={errors.phone} hint={t('checkout.contact.phoneHint')} className="ltr-text" />
        </div>
      </StepCard>
      <div className="mt-6 flex justify-end">
        <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto">
          {t('checkout.contact.continue')}
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────────── Shipping ─────────────────────────────

const etaLabel = (o: ShippingOption) =>
  !o.maxDays ? null : o.minDays === o.maxDays ? t('checkout.delivery.eta', { count: o.minDays }) : t('checkout.delivery.etaRange', { min: o.minDays, max: o.maxDays });

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
  const { t, tDynamic } = useT();
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
    if (!method || !selected) errs.method = t('checkout.delivery.choose');
    if (needsAddress && !addressId) {
      Object.assign(
        errs,
        validate(values, {
          line1: (v: string) => (v.trim().length < 3 ? t('checkout.delivery.errors.street') : undefined),
          city: required(t('checkout.delivery.errors.city')),
        }),
      );
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit(values, addressId, method, note.trim());
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <StepCard title={t('checkout.delivery.title')}>
        <fieldset>
          <legend className="sr-only">{t('checkout.delivery.choose')}</legend>
          {!options ? (
            <div className="space-y-3" aria-busy="true" aria-label={t('checkout.delivery.loading')}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : options.length === 0 ? (
            <InlineAlert tone="warning">{t('checkout.delivery.none')}</InlineAlert>
          ) : (
            <div className="space-y-3">
              {options.map((m) => (
                <label
                  key={m.code}
                  className={cn('flex cursor-pointer items-start gap-3 border p-4 sm:gap-4 transition-colors sm:p-5', method === m.code ? 'border-ink bg-paper-50' : 'border-paper-300 hover:border-ink/50')}
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
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{m.name}</span>
                      <span className="text-sm font-semibold tabular-nums">{m.isFree || m.fee === 0 ? <span className="text-success">{t('common.labels.free')}</span> : formatPrice(m.fee)}</span>
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

      <StepCard title={needsAddress ? t('checkout.delivery.shippingAddress') : t('checkout.delivery.collectionDetails')}>
        {!needsAddress && (
          <InlineAlert className="mb-5">
            {selected?.description || t('checkout.delivery.collectDefault')} {t('checkout.delivery.collectNote')}
          </InlineAlert>
        )}
        {needsAddress && (
          <>
            {addressesLoading ? (
              <Skeleton className="mb-6 h-14 w-full" />
            ) : (
              savedAddresses.length > 0 && (
                <div className="mb-6">
                  <p className="label">{t('checkout.delivery.savedAddresses')}</p>
                  <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
                    {savedAddresses.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => applySaved(a)}
                        aria-pressed={addressId === a.id}
                        className={cn('min-h-[44px] max-w-[16rem] shrink-0 border px-4 py-2 text-start text-sm transition-colors', addressId === a.id ? 'border-ink bg-paper-50' : 'border-paper-300 hover:border-ink')}
                      >
                        <span className="block font-semibold">
                          {a.label || `${a.firstName} ${a.lastName}`}
                          {a.isDefault && <span className="ms-2 text-2xs font-normal uppercase tracking-[0.12em] text-ink-500">{t('checkout.delivery.default')}</span>}
                        </span>
                        <span className="block truncate text-xs text-ink-500">
                          {a.line1}, {a.city}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label={t('checkout.delivery.address')} autoComplete="address-line1" value={values.line1} onChange={set('line1')} error={errors.line1} containerClassName="sm:col-span-2" />
              <TextField label={t('checkout.delivery.line2')} autoComplete="address-line2" value={values.line2} onChange={set('line2')} optional containerClassName="sm:col-span-2" />
              <TextField label={t('checkout.delivery.district')} value={values.district ?? ''} onChange={set('district')} optional />
              <SelectField label={t('checkout.delivery.city')} value={values.city} onChange={set('city')} error={errors.city} options={DJIBOUTI_CITIES.map((c) => ({ value: c, label: tDynamic(`checkout.cities.${c}`, c) }))} />
              <SelectField label={t('checkout.delivery.country')} value={values.country} onChange={set('country')} options={COUNTRIES.map((c) => ({ value: c.name, label: tDynamic(`checkout.countries.${c.name}`, c.name) }))} hint={t('checkout.delivery.countryHint')} />
              <TextField label={t('checkout.delivery.postalCode')} autoComplete="postal-code" value={values.postalCode} onChange={set('postalCode')} optional />
            </div>
          </>
        )}
        <TextAreaField
          label={t('checkout.delivery.note')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          optional
          maxLength={500}
          hint={t('checkout.delivery.noteHint')}
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
          {t('checkout.delivery.back')}
        </Button>
        <Button type="submit" variant="primary" size="lg" disabled={!options}>
          {t('checkout.delivery.continue')}
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────────── Payment ─────────────────────────────

const METHOD_UI: Record<PaymentMethodType, { label: () => string; description: () => string; icon: typeof CreditCard }> = {
  card: { label: () => t('checkout.payment.methods.card'), description: () => t('checkout.payment.methods.cardBody'), icon: CreditCard },
  'mobile-money': { label: () => t('checkout.payment.methods.mobileMoney'), description: () => t('checkout.payment.methods.mobileMoneyBody'), icon: Smartphone },
  'cash-on-delivery': { label: () => t('checkout.payment.methods.cashOnDelivery'), description: () => t('checkout.payment.methods.cashOnDeliveryBody'), icon: Banknote },
  'bank-transfer': { label: () => t('checkout.payment.methods.bankTransfer'), description: () => t('checkout.payment.methods.bankTransferBody'), icon: Building2 },
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
  const { t } = useT();
  const setCard = (patch: Partial<CardDetails>) => onChange({ ...values, card: { ...values.card, ...patch } });
  if (method === 'card') {
    return (
      <div className="grid animate-fade-in gap-5 sm:grid-cols-2">
        <TextField label={t('checkout.payment.cardName')} autoComplete="cc-name" value={values.card.name} onChange={(e) => setCard({ name: e.target.value })} error={errors.name} containerClassName="sm:col-span-2" />
        <TextField
          label={t('checkout.payment.cardNumber')}
          className="ltr-text"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="1234 5678 9012 3456"
          value={values.card.number}
          onChange={(e) => setCard({ number: formatCardNumber(e.target.value) })}
          error={errors.number}
          containerClassName="sm:col-span-2"
          rightSlot={<CreditCard className="h-4 w-4 text-ink-500" aria-hidden />}
        />
        <TextField label={t('checkout.payment.expiry')} className="ltr-text" inputMode="numeric" autoComplete="cc-exp" placeholder={t('checkout.payment.expiryPlaceholder')} value={values.card.expiry} onChange={(e) => setCard({ expiry: formatExpiry(e.target.value) })} error={errors.expiry} />
        <TextField label={t('checkout.payment.cvc')} className="ltr-text" inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} value={values.card.cvc} onChange={(e) => setCard({ cvc: e.target.value.replace(/\D/g, '') })} error={errors.cvc} />
      </div>
    );
  }
  if (method === 'mobile-money') {
    return (
      <div className="animate-fade-in">
        <TextField
          label={t('checkout.payment.wallet')}
          className="ltr-text"
          type="tel"
          inputMode="tel"
          placeholder="+253"
          value={values.wallet}
          onChange={(e) => onChange({ ...values, wallet: e.target.value })}
          error={errors.wallet}
          hint={t('checkout.payment.walletHint')}
        />
      </div>
    );
  }
  if (method === 'cash-on-delivery') {
    return <InlineAlert className="animate-fade-in">{t('checkout.payment.codNote', { amount: formatPrice(total) })}</InlineAlert>;
  }
  return <InlineAlert className="animate-fade-in">{t('checkout.payment.bankNote')}</InlineAlert>;
}

/** Validates the storefront form for the chosen method. Returns only the failing fields. */
export function validatePaymentFields(method: PaymentMethodType, values: PaymentFieldValues): Record<string, string> {
  const errs: Record<string, string | undefined> = {};
  if (method === 'card') {
    if (!values.card.name.trim()) errs.name = t('checkout.payment.errors.cardName');
    if (!luhn(values.card.number)) errs.number = t('checkout.payment.errors.cardNumber');
    errs.expiry = cardExpiry(values.card.expiry);
    if (!/^\d{3,4}$/.test(values.card.cvc)) errs.cvc = t('checkout.payment.errors.cvc');
  }
  if (method === 'mobile-money') errs.wallet = phone(values.wallet);
  return Object.fromEntries(Object.entries(errs).filter(([, v]) => v)) as Record<string, string>;
}

export function TestPaymentNotice() {
  const { t } = useT();
  const strong = (s: string) => <strong className="ltr-text font-semibold">{s}</strong>;
  return (
    <InlineAlert className="mb-6">
      <span className="flex gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          <RichText text={t('checkout.payment.testNotice')} parts={{ card: strong('4242 4242 4242 4242'), last: strong('0002'), example: <span className="ltr-text">4000 0000 0000 0002</span> }} />
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
  const { t } = useT();
  const [fields, setFields] = useState<PaymentFieldValues>(() => emptyPaymentFields(defaultPhone));
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!method) return setErrors({ method: t('checkout.payment.errors.method') });
    const errs: Record<string, string | undefined> = { ...validatePaymentFields(method, fields) };
    if (!agree) errs.agree = t('checkout.payment.errors.agree');
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
        title={t('checkout.payment.title')}
        aside={
          <span className="flex items-center gap-1.5 text-xs text-ink-500">
            <Lock className="h-3.5 w-3.5" aria-hidden /> {t('checkout.payment.secure')}
          </span>
        }
      >
        {isTest && isOnline && <TestPaymentNotice />}
        {methods.length === 0 ? (
          <InlineAlert tone="warning">{t('checkout.payment.unavailable')}</InlineAlert>
        ) : (
          <fieldset>
            <legend className="sr-only">{t('checkout.payment.legend')}</legend>
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
                      <span className="block text-sm font-semibold">{ui.label()}</span>
                      <span className="mt-0.5 block text-xs text-ink-500">{ui.description()}</span>
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
            <RichText
              text={t('checkout.payment.agree')}
              parts={{
                terms: (
                  <Link to={ROUTES.terms} target="_blank" className="underline underline-offset-2">
                    {t('checkout.payment.terms')}
                  </Link>
                ),
                privacy: (
                  <Link to={ROUTES.privacy} target="_blank" className="underline underline-offset-2">
                    {t('checkout.payment.privacy')}
                  </Link>
                ),
              }}
            />
          }
        />
        {errors.agree && <p className="field-error">{errors.agree}</p>}
      </div>

      {error && <InlineAlert tone="error">{error}</InlineAlert>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBack} disabled={placing || lockedMethod}>
          {t('checkout.payment.back')}
        </Button>
        <Button type="submit" variant="primary" size="lg" loading={placing} loadingText={placingText} disabled={!canPlace || methods.length === 0} leftIcon={<Lock className="h-4 w-4" />}>
          {lockedMethod ? t('checkout.payment.retry') : t('checkout.payment.place')} · {formatPrice(total)}
        </Button>
      </div>
    </form>
  );
}
