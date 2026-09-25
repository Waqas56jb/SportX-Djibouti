import { Lock } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, InlineAlert } from '@/components/common';
import { useT } from '@/i18n';
import { errorMessage } from '@/services';
import { newIdempotencyKey } from '@/services/api';
import { paymentService } from '@/services/paymentService';
import type { Order } from '@/types';
import { formatDateTime, formatPrice } from '@/utils/format';
import { PaymentFields, TestPaymentNotice, emptyPaymentFields, validatePaymentFields, type PaymentFieldValues } from './CheckoutForms';

/**
 * Pays (or retries paying) an order that is still PAYMENT_PENDING. The order keeps its payment
 * method; each attempt creates a new payment on the API.
 */
export function PaymentRetryPanel({ order, onSettled }: { order: Order; onSettled: (order: Order) => void }) {
  const { t } = useT();
  const method = order.payment.method;
  const [fields, setFields] = useState<PaymentFieldValues>(() => emptyPaymentFields(order.customer.phone));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(order.paymentStatus === 'failed' ? t('checkout.retry.declined') : null);
  const [isTest, setIsTest] = useState(false);
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    paymentService
      .methods()
      .then((m) => setIsTest(paymentService.isTestProvider(m)))
      .catch(() => undefined);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (paying) return;
    const errs = validatePaymentFields(method, fields);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setPaying(true);
    setError(null);
    keyRef.current ??= newIdempotencyKey();
    try {
      const paid = await paymentService.payOrder(order.id, { method, card: fields.card, phone: fields.wallet }, keyRef.current);
      keyRef.current = null;
      onSettled(paid);
    } catch (err) {
      keyRef.current = null; // a definitive failure → the next try is a new attempt
      setError(errorMessage(err, t('checkout.retry.failed')));
    } finally {
      setPaying(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="border border-paper-200 bg-white p-5 text-start sm:p-8">
      <h2 className="heading-sm">{t('checkout.retry.title')}</h2>
      <p className="mt-2 text-sm text-ink-600">
        {order.paymentExpiresAt
          ? t('checkout.retry.reservedUntil', { date: formatDateTime(order.paymentExpiresAt), amount: formatPrice(order.total) })
          : t('checkout.retry.reserved', { amount: formatPrice(order.total) })}
      </p>
      <div className="mt-6">
        {isTest && <TestPaymentNotice />}
        <PaymentFields method={method} values={fields} onChange={setFields} errors={errors} total={order.total} />
      </div>
      {error && (
        <InlineAlert tone="error" className="mt-5">
          {error}
        </InlineAlert>
      )}
      <Button type="submit" variant="primary" size="lg" fullWidth className="mt-6" loading={paying} loadingText={t('checkout.payment.processing')} leftIcon={<Lock className="h-4 w-4" />}>
        {t('checkout.retry.pay', { amount: formatPrice(order.total) })}
      </Button>
    </form>
  );
}
