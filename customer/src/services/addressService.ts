import type { Address, AddressInput } from '@/types';
import { uid } from '@/utils/id';
import { apiClient } from './api/client';
import { USE_MOCK_API } from './config';
import { db, delay } from './mock/db';

/** Ensures exactly one default address when the list is non-empty. */
function normaliseDefaults(list: Address[], preferredId?: string) {
  if (!list.length) return list;
  const target = preferredId ?? list.find((a) => a.isDefault)?.id ?? list[0].id;
  return list.map((a) => ({ ...a, isDefault: a.id === target }));
}

export const addressService = {
  async list(userId: string): Promise<Address[]> {
    if (!USE_MOCK_API) return apiClient.get<Address[]>('/me/addresses');
    await delay(250, 500);
    return db.read().addresses[userId] ?? [];
  },

  async create(userId: string, input: AddressInput): Promise<Address[]> {
    if (!USE_MOCK_API) return apiClient.post<Address[]>('/me/addresses', input);
    await delay(350, 600);
    const address: Address = { ...input, id: uid('adr') };
    const next = db.write((d) => {
      const list = [...(d.addresses[userId] ?? []), address];
      d.addresses[userId] = normaliseDefaults(list, input.isDefault ? address.id : undefined);
    });
    return next.addresses[userId];
  },

  async update(userId: string, id: string, input: AddressInput): Promise<Address[]> {
    if (!USE_MOCK_API) return apiClient.put<Address[]>(`/me/addresses/${id}`, input);
    await delay(350, 600);
    const next = db.write((d) => {
      const list = (d.addresses[userId] ?? []).map((a) => (a.id === id ? { ...input, id } : a));
      d.addresses[userId] = normaliseDefaults(list, input.isDefault ? id : undefined);
    });
    return next.addresses[userId];
  },

  async remove(userId: string, id: string): Promise<Address[]> {
    if (!USE_MOCK_API) return apiClient.delete<Address[]>(`/me/addresses/${id}`);
    await delay(300, 500);
    const next = db.write((d) => {
      d.addresses[userId] = normaliseDefaults((d.addresses[userId] ?? []).filter((a) => a.id !== id));
    });
    return next.addresses[userId];
  },

  async setDefault(userId: string, id: string): Promise<Address[]> {
    if (!USE_MOCK_API) return apiClient.post<Address[]>(`/me/addresses/${id}/default`);
    await delay(250, 450);
    const next = db.write((d) => {
      d.addresses[userId] = normaliseDefaults(d.addresses[userId] ?? [], id);
    });
    return next.addresses[userId];
  },
};
