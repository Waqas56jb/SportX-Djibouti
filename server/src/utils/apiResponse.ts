import type { Response } from 'express';
import type { PageMeta } from './pagination.js';

/** Success envelope: { success: true, data, message? }. */
export function ok<T>(res: Response, data: T, message?: string, status = 200) {
  return res.status(status).json({ success: true, data, ...(message ? { message } : {}) });
}

export function created<T>(res: Response, data: T, message?: string) {
  return ok(res, data, message, 201);
}

/** Paginated envelope: { success: true, data: [...], pagination: {...} }. */
export function paginated<T>(res: Response, data: T[], pagination: PageMeta, extra?: Record<string, unknown>) {
  return res.status(200).json({ success: true, data, pagination, ...(extra ?? {}) });
}

export function noContent(res: Response, message = 'Done.') {
  return res.status(200).json({ success: true, data: null, message });
}
