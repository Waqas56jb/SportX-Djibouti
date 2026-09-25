/**
 * In-browser mock database used until the SPORTX API is connected.
 * Persisted to localStorage so accounts, orders and tickets survive reloads.
 * Nothing in the UI imports this file — only services do.
 */
import { STORAGE_KEYS } from '@/constants/storage';
import { DEMO_CREDENTIALS, DEMO_USER, SEED_ADDRESSES, SEED_ORDERS, SEED_TICKETS, SEED_USER_REVIEWS } from '@/data/mockSeed';
import type { Address, Order, Review, SupportTicket, User } from '@/types';
import { storage } from '@/utils/storage';

const DB_VERSION = 1;

export interface MockUserRecord extends User {
  /** Demo only — a real backend stores a salted hash, never the password. */
  password: string;
}

export interface MockDb {
  version: number;
  users: MockUserRecord[];
  addresses: Record<string, Address[]>;
  orders: Order[];
  reviews: Review[];
  tickets: SupportTicket[];
  wishlists: Record<string, string[]>;
  newsletter: string[];
}

const seed = (): MockDb => ({
  version: DB_VERSION,
  users: [{ ...DEMO_USER, password: DEMO_CREDENTIALS.password }],
  addresses: { [DEMO_USER.id]: SEED_ADDRESSES },
  orders: SEED_ORDERS,
  reviews: SEED_USER_REVIEWS,
  tickets: SEED_TICKETS,
  wishlists: {},
  newsletter: [],
});

let cache: MockDb | null = null;

export const db = {
  read(): MockDb {
    if (cache) return cache;
    const stored = storage.get<MockDb | null>(STORAGE_KEYS.mockDb, null);
    cache = stored && stored.version === DB_VERSION ? stored : seed();
    if (!stored) storage.set(STORAGE_KEYS.mockDb, cache);
    return cache;
  },
  write(mutate: (draft: MockDb) => void) {
    const next = structuredClone(db.read());
    mutate(next);
    cache = next;
    storage.set(STORAGE_KEYS.mockDb, next);
    return next;
  },
};

/** Simulated network latency so loading states are exercised in development. */
export const delay = (min = 250, max = 600) =>
  new Promise<void>((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));

export class MockError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'MockError';
  }
}
