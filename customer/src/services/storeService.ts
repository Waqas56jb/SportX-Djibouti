import { api } from './api';

/** Public store configuration (`GET /store`). */
export interface StoreSettings {
  storeName: string;
  tagline: string | null;
  supportEmail: string | null;
  phone: string | null;
  address: string[];
  country: string;
  currency: string;
  timezone: string;
  logoUrl: string | null;
  taxRate: number;
  taxInclusive: boolean;
  /** Merchandise total (after discounts) from which delivery is free; null = no free delivery. */
  freeShippingThreshold: number | null;
  maxQuantityPerLine: number;
}

const TTL_MS = 5 * 60_000;
let cached: { at: number; value: StoreSettings } | null = null;
let inflight: Promise<StoreSettings> | null = null;

export const storeService = {
  /** Cached for a few minutes; concurrent callers share one request. */
  get(force = false): Promise<StoreSettings> {
    if (!force && cached && Date.now() - cached.at < TTL_MS) return Promise.resolve(cached.value);
    inflight ??= api
      .get<StoreSettings>('/store')
      .then((value) => {
        cached = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },

  /** Last loaded settings, synchronously (undefined until the first load). */
  peek(): StoreSettings | undefined {
    return cached?.value;
  },
};
