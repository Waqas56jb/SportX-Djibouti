import type { DiscountType } from '../types/common.js';

/** All money is integer minor-less amounts in the store currency (DJF). */
export const clampMoney = (n: number) => Math.max(0, Math.round(n));

/** Discount amount for one unit / amount, never exceeding the base. */
export function discountAmount(base: number, type: DiscountType, value: number, cap?: number | null): number {
  const raw = type === 'PERCENTAGE' ? Math.round((base * value) / 100) : value;
  const capped = cap != null ? Math.min(raw, cap) : raw;
  return Math.min(base, clampMoney(capped));
}

/** Tax on an amount. Inclusive: tax portion already inside `amount`; exclusive: added on top. */
export function taxOf(amount: number, ratePercent: number, inclusive: boolean): number {
  if (ratePercent <= 0 || amount <= 0) return 0;
  return inclusive ? Math.round(amount - amount / (1 + ratePercent / 100)) : Math.round((amount * ratePercent) / 100);
}
