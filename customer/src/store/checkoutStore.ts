import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LAUNCH_COUNTRY } from '@/constants/commerce';
import { STORAGE_KEYS } from '@/constants/storage';
import { newIdempotencyKey } from '@/services/api';
import type { CheckoutAddress, CheckoutContact, CheckoutStep, PaymentMethodType } from '@/types';

interface CheckoutState {
  step: CheckoutStep;
  contact: CheckoutContact;
  /** Saved address chosen from the account (`GET /addresses`), or null to use `address`. */
  addressId: string | null;
  address: CheckoutAddress;
  /** Shipping method code; empty until the API has quoted options. */
  shippingMethod: string;
  paymentMethod: PaymentMethodType | null;
  customerNote: string;
  /** Idempotency-Key for `POST /orders` — one per checkout attempt, reused on retries / double clicks. */
  attemptKey: string | null;
  /** Order already created in this attempt whose online payment is not finished (retry pays it). */
  pendingOrderId: string | null;
  setStep: (step: CheckoutStep) => void;
  setContact: (contact: CheckoutContact) => void;
  setAddress: (address: CheckoutAddress) => void;
  setAddressId: (id: string | null) => void;
  setShippingMethod: (code: string) => void;
  setPaymentMethod: (method: PaymentMethodType) => void;
  setCustomerNote: (note: string) => void;
  /** Returns the current attempt key, creating it on first use. */
  ensureAttemptKey: () => string;
  setPendingOrder: (orderId: string | null) => void;
  reset: () => void;
}

const initial = {
  step: 'information' as CheckoutStep,
  contact: { firstName: '', lastName: '', email: '', phone: '' },
  addressId: null as string | null,
  address: { line1: '', line2: '', district: '', city: 'Djibouti City', country: LAUNCH_COUNTRY, postalCode: '' },
  shippingMethod: '',
  paymentMethod: null as PaymentMethodType | null,
  customerNote: '',
  attemptKey: null as string | null,
  pendingOrderId: null as string | null,
};

/** Checkout progress lives in sessionStorage — it should not outlive the tab. Card data is never stored. */
export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set, get) => ({
      ...initial,
      setStep: (step) => set({ step }),
      setContact: (contact) => set({ contact }),
      setAddress: (address) => set({ address }),
      setAddressId: (addressId) => set({ addressId }),
      setShippingMethod: (shippingMethod) => set({ shippingMethod }),
      setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
      setCustomerNote: (customerNote) => set({ customerNote }),
      ensureAttemptKey: () => {
        const existing = get().attemptKey;
        if (existing) return existing;
        const key = newIdempotencyKey();
        set({ attemptKey: key });
        return key;
      },
      setPendingOrder: (pendingOrderId) => set({ pendingOrderId }),
      reset: () => set(initial),
    }),
    { name: STORAGE_KEYS.checkout, version: 2, storage: createJSONStorage(() => sessionStorage), migrate: () => ({ ...initial }) as unknown as CheckoutState },
  ),
);
