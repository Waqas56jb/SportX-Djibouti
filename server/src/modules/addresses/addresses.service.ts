import type { PoolClient } from 'pg';
import { pool, query, queryOne, withTransaction, type Db } from '../../config/database.js';
import { conflict, notFound } from '../../utils/errors.js';
import { iso } from '../account/schema-helpers.js';
import type { CreateAddressInput, UpdateAddressInput } from './addresses.schema.js';

const MAX_ADDRESSES = 20;

export interface AddressRow {
  id: string;
  user_id: string;
  label: string;
  first_name: string;
  last_name: string;
  phone: string;
  address_line_1: string;
  address_line_2: string | null;
  district: string | null;
  city: string;
  country: string;
  postal_code: string | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export function toAddress(a: AddressRow) {
  return {
    id: a.id,
    label: a.label,
    firstName: a.first_name,
    lastName: a.last_name,
    fullName: `${a.first_name} ${a.last_name}`,
    phone: a.phone,
    addressLine1: a.address_line_1,
    addressLine2: a.address_line_2,
    /** Storefront aliases. */
    line1: a.address_line_1,
    line2: a.address_line_2 ?? undefined,
    district: a.district,
    city: a.city,
    country: a.country,
    postalCode: a.postal_code,
    isDefault: a.is_default,
    createdAt: iso(a.created_at)!,
    updatedAt: iso(a.updated_at)!,
  };
}
export type Address = ReturnType<typeof toAddress>;

const COLUMNS: Record<string, string> = {
  label: 'label',
  firstName: 'first_name',
  lastName: 'last_name',
  phone: 'phone',
  addressLine1: 'address_line_1',
  addressLine2: 'address_line_2',
  district: 'district',
  city: 'city',
  country: 'country',
  postalCode: 'postal_code',
};

/** Serialises address writes per user so the "exactly one default" invariant holds under concurrency. */
async function lockUser(tx: PoolClient, userId: string) {
  await query(`select id from public.users where id = $1 for update`, [userId], tx);
}

async function getOwned(db: Db, userId: string, id: string): Promise<AddressRow> {
  const row = await queryOne<AddressRow>(`select * from public.addresses where id = $1 and user_id = $2`, [id, userId], db);
  if (!row) throw notFound('Address');
  return row;
}

async function makeDefault(tx: PoolClient, userId: string, id: string) {
  // Clear first: the partial unique index allows only one default per user.
  await query(`update public.addresses set is_default = false where user_id = $1 and is_default and id <> $2`, [userId, id], tx);
  await query(`update public.addresses set is_default = true where id = $1 and user_id = $2 and not is_default`, [id, userId], tx);
}

/** Promotes the most recent address when the user has addresses but no default. */
async function ensureDefault(tx: PoolClient, userId: string) {
  await query(
    `update public.addresses set is_default = true
      where id = (select id from public.addresses where user_id = $1 order by created_at desc, id desc limit 1)
        and not exists (select 1 from public.addresses where user_id = $1 and is_default)`,
    [userId],
    tx,
  );
}

export const addressesService = {
  async list(userId: string, db: Db = pool) {
    const rows = await query<AddressRow>(`select * from public.addresses where user_id = $1 order by is_default desc, created_at desc, id`, [userId], db);
    return rows.map(toAddress);
  },

  async get(userId: string, id: string) {
    return toAddress(await getOwned(pool, userId, id));
  },

  async create(userId: string, input: CreateAddressInput) {
    const id = await withTransaction(async (tx) => {
      await lockUser(tx, userId);
      const count = await queryOne<{ n: number }>(`select count(*)::int as n from public.addresses where user_id = $1`, [userId], tx);
      if ((count?.n ?? 0) >= MAX_ADDRESSES) throw conflict(`You can save up to ${MAX_ADDRESSES} addresses.`);
      const row = await queryOne<{ id: string }>(
        `insert into public.addresses (user_id, label, first_name, last_name, phone, address_line_1, address_line_2, district, city, country, postal_code, is_default)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false) returning id`,
        [userId, input.label, input.firstName, input.lastName, input.phone, input.addressLine1, input.addressLine2 ?? null, input.district ?? null, input.city, input.country, input.postalCode ?? null],
        tx,
      );
      // The first address always becomes the default.
      if (input.isDefault || (count?.n ?? 0) === 0) await makeDefault(tx, userId, row!.id);
      return row!.id;
    });
    return this.get(userId, id);
  },

  async update(userId: string, id: string, input: UpdateAddressInput) {
    await withTransaction(async (tx) => {
      await lockUser(tx, userId);
      await getOwned(tx, userId, id);
      const sets: string[] = [];
      const params: unknown[] = [id, userId];
      for (const [key, col] of Object.entries(COLUMNS)) {
        const value = (input as Record<string, unknown>)[key];
        if (value === undefined) continue;
        params.push(value);
        sets.push(`${col} = $${params.length}`);
      }
      if (sets.length) await query(`update public.addresses set ${sets.join(', ')} where id = $1 and user_id = $2`, params, tx);
      // Unsetting the default is ignored: another address must be chosen as default instead.
      if (input.isDefault === true) await makeDefault(tx, userId, id);
    });
    return this.get(userId, id);
  },

  async setDefault(userId: string, id: string) {
    await withTransaction(async (tx) => {
      await lockUser(tx, userId);
      await getOwned(tx, userId, id);
      await makeDefault(tx, userId, id);
    });
    return this.get(userId, id);
  },

  async remove(userId: string, id: string) {
    await withTransaction(async (tx) => {
      await lockUser(tx, userId);
      await getOwned(tx, userId, id);
      await query(`delete from public.addresses where id = $1 and user_id = $2`, [id, userId], tx);
      await ensureDefault(tx, userId);
    });
  },
};
