import type { Coupon, CouponInput, CouponType, CustomerGroup } from '@/types';
import { COUPON_CODE_RE, endOfDayIso, fromLocalInput, toLocalDateInput } from './utils';

export interface CouponFormState {
  code: string;
  description: string;
  type: CouponType;
  value: number | '';
  minOrder: number | '';
  maxDiscount: number | '';
  usageLimit: number | '';
  perCustomerLimit: number | '';
  startDate: string;
  endDate: string;
  categoryIds: string[];
  productIds: string[];
  customerGroups: CustomerGroup[];
  enabled: boolean;
}

export type CouponFormErrors = Partial<Record<keyof CouponFormState, string>>;

export function couponToForm(c: Coupon | undefined, duplicate = false): CouponFormState {
  if (!c) {
    return {
      code: '',
      description: '',
      type: 'percentage',
      value: 10,
      minOrder: '',
      maxDiscount: '',
      usageLimit: '',
      perCustomerLimit: 1,
      startDate: toLocalDateInput(new Date().toISOString()),
      endDate: '',
      categoryIds: [],
      productIds: [],
      customerGroups: [],
      enabled: true,
    };
  }
  return {
    code: duplicate ? `${c.code}-COPY`.slice(0, 20) : c.code,
    description: c.description,
    type: c.type,
    value: c.value,
    minOrder: c.minOrder || '',
    maxDiscount: c.maxDiscount ?? '',
    usageLimit: c.usageLimit ?? '',
    perCustomerLimit: c.perCustomerLimit ?? '',
    startDate: duplicate ? toLocalDateInput(new Date().toISOString()) : toLocalDateInput(c.startsAt),
    endDate: duplicate ? '' : toLocalDateInput(c.endsAt),
    categoryIds: [...c.categoryIds],
    productIds: [...c.productIds],
    customerGroups: c.customerGroups.filter((g) => g !== 'all'),
    enabled: duplicate ? true : c.enabled,
  };
}

const num = (v: number | '') => (v === '' ? undefined : v);

export function formToInput(f: CouponFormState): CouponInput {
  return {
    code: f.code.trim().toUpperCase(),
    description: f.description.trim(),
    type: f.type,
    value: f.value === '' ? 0 : f.value,
    minOrder: f.minOrder === '' ? 0 : f.minOrder,
    maxDiscount: f.type === 'percentage' ? num(f.maxDiscount) : undefined,
    usageLimit: num(f.usageLimit),
    perCustomerLimit: num(f.perCustomerLimit),
    startsAt: fromLocalInput(f.startDate),
    endsAt: f.endDate ? endOfDayIso(f.endDate) : undefined,
    enabled: f.enabled,
    categoryIds: f.categoryIds,
    productIds: f.productIds,
    customerGroups: f.customerGroups,
  };
}

const isInt = (v: number) => Number.isInteger(v);

export function validateCoupon(f: CouponFormState, usageCount = 0): CouponFormErrors {
  const e: CouponFormErrors = {};
  const code = f.code.trim();
  if (!code) e.code = 'Coupon code is required.';
  else if (!COUPON_CODE_RE.test(code)) e.code = 'Use 3–20 characters: A–Z, 0–9, dash or underscore.';

  if (f.value === '' || f.value <= 0) e.value = 'Enter a discount value greater than zero.';
  else if (f.type === 'percentage' && f.value > 100) e.value = 'A percentage can’t exceed 100%.';
  else if (f.type === 'percentage' && !isInt(f.value)) e.value = 'Use a whole percentage.';

  if (f.minOrder !== '' && f.minOrder < 0) e.minOrder = 'Minimum order can’t be negative.';
  if (f.type === 'fixed' && f.value !== '' && f.minOrder !== '' && f.minOrder > 0 && f.value >= f.minOrder) e.value = 'A fixed discount must be lower than the minimum order.';
  if (f.type === 'percentage' && f.maxDiscount !== '' && f.maxDiscount <= 0) e.maxDiscount = 'Maximum discount must be greater than zero.';

  if (f.usageLimit !== '') {
    if (f.usageLimit < 1 || !isInt(f.usageLimit)) e.usageLimit = 'Use a whole number of 1 or more.';
    else if (f.usageLimit < usageCount) e.usageLimit = `Can’t be below the ${usageCount} redemptions already made.`;
  }
  if (f.perCustomerLimit !== '') {
    if (f.perCustomerLimit < 1 || !isInt(f.perCustomerLimit)) e.perCustomerLimit = 'Use a whole number of 1 or more.';
    else if (f.usageLimit !== '' && f.perCustomerLimit > f.usageLimit) e.perCustomerLimit = 'Can’t exceed the total usage limit.';
  }

  if (!f.startDate) e.startDate = 'Start date is required.';
  if (f.endDate && f.startDate && endOfDayIso(f.endDate) <= fromLocalInput(f.startDate)) e.endDate = 'End date can’t be before the start date.';
  if (f.description.length > 120) e.description = 'Keep the internal note under 120 characters.';
  return e;
}
