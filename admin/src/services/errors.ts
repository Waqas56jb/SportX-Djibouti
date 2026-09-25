import { ApiError } from './api';

/**
 * Human-readable message for an API error. For VALIDATION_ERROR responses the generic
 * "Request validation failed." is replaced by the field messages zod reported, e.g.
 * "note: A note is required when the reason is "Other"."
 */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(e instanceof Error)) return fallback;
  if (e instanceof ApiError && e.code === 'VALIDATION_ERROR' && e.details && typeof e.details === 'object') {
    const d = e.details as { body?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] }; query?: { fieldErrors?: Record<string, string[]> } };
    const src = d.body ?? d.query;
    const fields = Object.entries(src?.fieldErrors ?? {}).map(([k, v]) => `${k}: ${v.join(' ')}`);
    const form = d.body?.formErrors ?? [];
    const parts = [...form, ...fields];
    if (parts.length) return parts.join(' · ');
  }
  return e.message || fallback;
}
