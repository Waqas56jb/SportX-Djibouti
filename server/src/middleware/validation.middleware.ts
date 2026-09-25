import type { Request, RequestHandler } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { AppError } from '../utils/errors.js';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates and coerces body/query/params. Invalid input is rejected with VALIDATION_ERROR
 * and never reaches a controller. Parsed body replaces req.body (unknown keys stripped);
 * parsed query is available via `query(req)`.
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    const issues: Record<string, unknown> = {};
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) issues[part] = result.error.flatten();
      else if (part === 'query') req.validatedQuery = result.data;
      else (req as unknown as Record<string, unknown>)[part] = result.data;
    }
    if (Object.keys(issues).length) return next(new AppError('VALIDATION_ERROR', 'Request validation failed.', issues));
    next();
  };

/** Typed access to the validated query string. */
export const query = <T>(req: Request): T => (req.validatedQuery ?? {}) as T;

export const uuidParam = (name = 'id') => z.object({ [name]: z.string().uuid(`Invalid ${name}.`) });
export const uuid = () => z.string().uuid();
