import { ApiError } from '@/services/api';
import { toast } from '@/store/toastStore';

export type FieldErrors = Record<string, string>;

const CONTAINERS = new Set(['body', 'query', 'params', 'fieldErrors']);
const looksLikeMessage = (s: string) => /\s/.test(s) || /[.!?]$/.test(s);

/**
 * Field errors from an API validation error. Handles the three shapes the server returns:
 *  - `{ body: { formErrors, fieldErrors: { field: [msg] } } }` (zod validation middleware)
 *  - `{ fieldErrors: { field: [msg] } }` (service-level checks)
 *  - `{ field: 'msg' | value }` (badRequest details — a non-message value gets the error message)
 * `alias` renames API fields to form fields, e.g. `{ supportEmail: 'email' }`.
 */
export function apiFieldErrors(e: unknown, alias: Record<string, string> = {}): FieldErrors {
  if (!(e instanceof ApiError) || !e.details || typeof e.details !== 'object') return {};
  const out: FieldErrors = {};
  const put = (key: string, v: unknown) => {
    const first = Array.isArray(v) ? v[0] : v;
    const msg = typeof first === 'string' && looksLikeMessage(first) ? first : e.message;
    const k = alias[key] ?? key;
    if (!out[k]) out[k] = msg;
  };
  const walk = (obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'formErrors') continue;
      if (CONTAINERS.has(k) && v && typeof v === 'object' && !Array.isArray(v)) walk(v as Record<string, unknown>);
      else put(k, v);
    }
  };
  walk(e.details as Record<string, unknown>);
  return out;
}

/**
 * Standard form error handling: returns the field errors that belong to the form (only `fields`
 * when given); when none match, shows a toast with the server message instead.
 */
export function handleFormError(e: unknown, title: string, opts: { alias?: Record<string, string>; fields?: readonly string[] } = {}): FieldErrors {
  const all = apiFieldErrors(e, opts.alias);
  const errs = opts.fields ? Object.fromEntries(Object.entries(all).filter(([k]) => opts.fields!.includes(k))) : all;
  if (!Object.keys(errs).length) toast.error(title, { description: e instanceof Error ? e.message : undefined });
  return errs;
}

export const errorMessage = (e: unknown, fallback = 'Something went wrong.') => (e instanceof Error && e.message ? e.message : fallback);
