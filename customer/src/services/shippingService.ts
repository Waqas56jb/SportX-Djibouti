import type { ShippingMethod } from '@/types';
import { tDynamic } from '@/i18n';
import { api } from './api';

interface ApiShippingMethod {
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
}

export interface ShippingMethodsResult {
  freeShippingThreshold: number | null;
  currency: string;
  methods: (ShippingMethod & { freeShippingThreshold: number | null; carrier: string | null })[];
}

/** Translated name of a built-in shipping method; methods created in the admin keep their own name. */
export const shippingMethodName = (code: string | null | undefined, name: string) => (code ? tDynamic(`checkout.shippingMethods.${code}.name`, name) : name);
export const shippingMethodDescription = (code: string | null | undefined, text: string) => (code ? tDynamic(`checkout.shippingMethods.${code}.description`, text) : text);

export const toShippingMethod = (m: ApiShippingMethod) => ({
  id: m.code,
  name: shippingMethodName(m.code, m.name),
  description: shippingMethodDescription(m.code, m.description),
  price: m.price,
  eta: [m.minDays, m.maxDays] as [number, number],
  requiresAddress: m.requiresAddress,
  freeShippingThreshold: m.freeShippingThreshold,
  carrier: m.carrier,
});

let cached: Promise<ShippingMethodsResult> | null = null;

export const shippingService = {
  /** Active shipping methods and the store's free-delivery threshold (`GET /shipping/methods`). */
  methods(force = false): Promise<ShippingMethodsResult> {
    if (force || !cached) {
      cached = api
        .get<{ freeShippingThreshold: number | null; currency: string; methods: ApiShippingMethod[] }>('/shipping/methods')
        .then((r) => ({ freeShippingThreshold: r.freeShippingThreshold, currency: r.currency, methods: r.methods.map(toShippingMethod) }))
        .catch((err) => {
          cached = null;
          throw err;
        });
    }
    return cached;
  },
};
