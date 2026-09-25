import type { PaymentMethodType } from './order';

export interface CheckoutContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface CheckoutAddress {
  line1: string;
  line2: string;
  city: string;
  country: string;
  postalCode: string;
}

export type CheckoutStep = 'information' | 'shipping' | 'payment';

/** Card details exist only in component state and are never persisted. */
export interface CardDetails {
  name: string;
  number: string;
  expiry: string;
  cvc: string;
}

export interface PlaceOrderPayload {
  contact: CheckoutContact;
  address: CheckoutAddress;
  shippingMethodId: string;
  paymentMethod: PaymentMethodType;
  paymentReference?: string;
}
