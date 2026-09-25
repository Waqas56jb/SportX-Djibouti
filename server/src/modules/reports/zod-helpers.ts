import { z } from 'zod';

/** Enum that also accepts the admin UI's lower-case spelling ("active" → "ACTIVE"). */
export const upperEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v), z.enum(values));

/** Enum that also accepts upper-case spelling ("ACTIVE" → "active"). */
export const lowerEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.enum(values));

/** ISO timestamp with offset, or a YYYY-MM-DD date (start of day UTC). */
export const isoDate = () =>
  z
    .string()
    .trim()
    .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isNaN(Date.parse(s)), 'Invalid date.')
    .transform((s) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s).toISOString());

export const iso = (v: Date | string | null | undefined) => (v ? new Date(v).toISOString() : null);

/** Money in integer DJF. */
export const money = () => z.number().int().min(0).max(1_000_000_000);
