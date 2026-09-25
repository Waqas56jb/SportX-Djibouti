import { z } from 'zod';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export const paginationQuery = (maxLimit = 100, defaultLimit = 20) =>
  z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(maxLimit).default(defaultLimit),
  });

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 };
}

export const offsetOf = (page: number, limit: number) => (page - 1) * limit;

/** Standard admin list query: search, status, date range, sort, pagination. */
export const adminListQuery = <S extends [string, ...string[]]>(sorts: S) =>
  paginationQuery(100, 20).extend({
    search: z.string().trim().max(120).optional(),
    date_from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    date_to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    sort: z.enum(sorts).optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  });

/** Inclusive end-of-day for date-only strings. */
export function dateBounds(from?: string, to?: string): { from?: string; to?: string } {
  const f = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? `${from}T00:00:00.000Z` : from;
  const t = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999Z` : to;
  return { from: f, to: t };
}
