import type { ApiPaymentMethod, PaymentMethodType } from './order';
import type { CartIssue, Coupon, CartTotals } from './cart';

export interface CheckoutContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface CheckoutAddress {
  line1: string;
  line2: string;
  district?: string;
  city: string;
  country: string;
  postalCode: string;
}

export type CheckoutStep = 'information' | 'shipping' | 'payment';

/** Card details exist only in component state and are never persisted or sent to the API. */
export interface CardDetails {
  name: string;
  number: string;
  expiry: string;
  cvc: string;
}

/** A shipping option quoted by `POST /checkout/validate`. */
export interface ShippingOption {
  methodId: string;
  code: string;
  name: string;
  description: string;
  fee: number;
  isFree: boolean;
  requiresAddress: boolean;
  carrier: string | null;
  minDays: number;
  maxDays: number;
  earliest: string | null;
  latest: string | null;
}

/** A payment method the API currently accepts (`paymentMethods` / `GET /payments/methods`). */
export interface PaymentMethodOption {
  method: ApiPaymentMethod;
  type: PaymentMethodType;
  provider: string;
  label: string;
}

export interface CheckoutProblem {
  field: string;
  message: string;
}

/** Server-authoritative checkout snapshot. */
export interface CheckoutValidation {
  valid: boolean;
  problems: CheckoutProblem[];
  issues: CartIssue[];
  totals: CartTotals;
  coupon: Coupon | null;
  /** Selected method quote, when a shipping method was sent. */
  shipping: { code: string; name: string; fee: number; isFree: boolean } | null;
  shippingOptions: ShippingOption[];
  paymentMethods: PaymentMethodOption[];
}

export interface PlaceOrderInput {
  addressId?: string;
  address?: {
    firstName: string;
    lastName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string | null;
    district?: string | null;
    city: string;
    country?: string;
    postalCode?: string | null;
  };
  shippingMethod: string;
  paymentMethod: ApiPaymentMethod;
  couponCode?: string | null;
  customerNote?: string | null;
}
