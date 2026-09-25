/**
 * Shipping provider abstraction. The internal provider prices from the shipping_methods table;
 * a carrier integration (label creation, live rates, tracking webhooks) can implement the same
 * interface later without touching checkout or order code.
 */
export interface ShippingQuoteInput {
  method: ShippingMethodRecord;
  /** Merchandise total after product and coupon discounts. */
  merchandiseTotal: number;
  storeFreeShippingThreshold: number | null;
  city?: string;
}

export interface ShippingMethodRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  freeShippingThreshold: number | null;
  minDays: number;
  maxDays: number;
  requiresAddress: boolean;
  carrier: string | null;
  regions: string[];
}

export interface ShippingQuote {
  methodId: string;
  code: string;
  name: string;
  fee: number;
  isFree: boolean;
  estimatedDelivery: { minDays: number; maxDays: number; earliest: string; latest: string };
}

export interface ShippingProvider {
  readonly name: string;
  quote(input: ShippingQuoteInput, now?: Date): ShippingQuote;
}

/** Adds business days, skipping Fridays (the Djibouti weekend). */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 5) added++;
  }
  return d;
}

export const internalShippingProvider: ShippingProvider = {
  name: 'internal',
  quote({ method, merchandiseTotal, storeFreeShippingThreshold }, now = new Date()) {
    const threshold = method.freeShippingThreshold ?? storeFreeShippingThreshold;
    const isFree = method.price === 0 || (threshold != null && merchandiseTotal > 0 && merchandiseTotal >= threshold);
    return {
      methodId: method.id,
      code: method.code,
      name: method.name,
      fee: isFree ? 0 : method.price,
      isFree,
      estimatedDelivery: {
        minDays: method.minDays,
        maxDays: method.maxDays,
        earliest: addBusinessDays(now, method.minDays).toISOString(),
        latest: addBusinessDays(now, method.maxDays).toISOString(),
      },
    };
  },
};
