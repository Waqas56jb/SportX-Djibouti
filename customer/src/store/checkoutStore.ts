import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LAUNCH_COUNTRY, SHIPPING_METHODS } from '@/constants/commerce';
import { STORAGE_KEYS } from '@/constants/storage';
import type { CheckoutAddress, CheckoutContact, CheckoutStep, PaymentMethodType } from '@/types';

interface CheckoutState {
  step: CheckoutStep;
  contact: CheckoutContact;
  address: CheckoutAddress;
  shippingMethodId: string;
  paymentMethod: PaymentMethodType;
  setStep: (step: CheckoutStep) => void;
  setContact: (contact: CheckoutContact) => void;
  setAddress: (address: CheckoutAddress) => void;
  setShippingMethod: (id: string) => void;
  setPaymentMethod: (method: PaymentMethodType) => void;
  reset: () => void;
}

const initial = {
  step: 'information' as CheckoutStep,
  contact: { firstName: '', lastName: '', email: '', phone: '' },
  address: { line1: '', line2: '', city: 'Djibouti City', country: LAUNCH_COUNTRY, postalCode: '' },
  shippingMethodId: SHIPPING_METHODS[0].id,
  paymentMethod: 'card' as PaymentMethodType,
};

/** Checkout progress lives in sessionStorage — it should not outlive the tab. */
export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      ...initial,
      setStep: (step) => set({ step }),
      setContact: (contact) => set({ contact }),
      setAddress: (address) => set({ address }),
      setShippingMethod: (shippingMethodId) => set({ shippingMethodId }),
      setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
      reset: () => set(initial),
    }),
    { name: STORAGE_KEYS.checkout, storage: createJSONStorage(() => sessionStorage) },
  ),
);
