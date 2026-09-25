import { z } from 'zod';

/**
 * Enum that accepts the canonical UPPER_SNAKE value as well as the lower-case / kebab-case spelling
 * the frontends use ("in-progress", "waiting_customer"). Output is always the canonical value.
 */
export const looseEnum = <T extends [string, ...string[]]>(values: T, aliases: Record<string, T[number]> = {}) =>
  z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    const key = v.trim().toUpperCase().replace(/[-\s]+/g, '_');
    return aliases[key] ?? key;
  }, z.enum(values));

/** Optional text that treats '' as "not provided" (null). */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** Boolean query flags: "true"/"1" → true, "false"/"0" → false. */
export const queryBool = z.preprocess((v) => (v === 'true' || v === '1' ? true : v === 'false' || v === '0' ? false : v), z.boolean().optional());

export const iso = (v: Date | string | null | undefined) => (v ? new Date(v).toISOString() : null);

export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'] as const;
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'] as const;
export const TICKET_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const TICKET_CATEGORIES = ['ORDER', 'DELIVERY', 'RETURNS', 'PAYMENT', 'PRODUCT', 'ACCOUNT', 'OTHER'] as const;
export const TICKET_CATEGORY_ALIASES: Record<string, (typeof TICKET_CATEGORIES)[number]> = { RETURN: 'RETURNS' };
