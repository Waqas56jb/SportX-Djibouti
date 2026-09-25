import type { Address, AddressInput } from '@/types';
import { api } from './api';

/** Address as sent by the API (it includes both `addressLine1` and the storefront `line1` alias). */
interface ApiAddress {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1?: string;
  addressLine2?: string | null;
  line1?: string;
  line2?: string | null;
  district?: string | null;
  city: string;
  country: string;
  postalCode?: string | null;
  isDefault: boolean;
}

export const toAddress = (a: ApiAddress): Address => ({
  id: a.id,
  label: a.label,
  firstName: a.firstName,
  lastName: a.lastName,
  phone: a.phone,
  line1: a.addressLine1 ?? a.line1 ?? '',
  line2: (a.addressLine2 ?? a.line2) || undefined,
  district: a.district || undefined,
  city: a.city,
  country: a.country,
  postalCode: a.postalCode || undefined,
  isDefault: a.isDefault,
});

const toBody = (input: Partial<AddressInput>) => ({
  label: input.label,
  firstName: input.firstName,
  lastName: input.lastName,
  phone: input.phone,
  addressLine1: input.line1,
  addressLine2: input.line2 ?? '',
  district: input.district ?? '',
  city: input.city,
  country: input.country,
  postalCode: input.postalCode ?? '',
  isDefault: input.isDefault,
});

const list = async (): Promise<Address[]> => (await api.get<ApiAddress[]>('/addresses')).map(toAddress);

/**
 * The signed-in customer's address book. Every mutation returns the refreshed list so pages can
 * render the server's "exactly one default" result. The `userId` arguments are ignored (identity
 * comes from the access token) and are kept for existing callers.
 */
export const addressService = {
  list: (_userId?: string) => list(),

  get: async (id: string) => toAddress(await api.get<ApiAddress>(`/addresses/${id}`)),

  async create(_userId: string | undefined, input: AddressInput): Promise<Address[]> {
    await api.post<ApiAddress>('/addresses', toBody(input));
    return list();
  },

  async update(_userId: string | undefined, id: string, input: AddressInput): Promise<Address[]> {
    await api.patch<ApiAddress>(`/addresses/${id}`, toBody(input));
    return list();
  },

  async remove(_userId: string | undefined, id: string): Promise<Address[]> {
    await api.delete<void>(`/addresses/${id}`);
    return list();
  },

  async setDefault(_userId: string | undefined, id: string): Promise<Address[]> {
    await api.patch<ApiAddress>(`/addresses/${id}/default`);
    return list();
  },
};
