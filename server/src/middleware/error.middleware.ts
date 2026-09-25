import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}.` } });
};

/** Maps well-known Postgres errors to safe API errors without leaking SQL details. */
function fromPostgres(err: { code?: string; constraint?: string }): AppError | null {
  switch (err.code) {
    case '23505':
      return new AppError('CONFLICT', 'A record with these details already exists.', err.constraint ? { constraint: err.constraint } : undefined);
    case '23503':
      return new AppError('CONFLICT', 'This record is referenced by other data and cannot be changed this way.');
    case '23514':
      if (err.constraint?.startsWith('inventory')) return new AppError('OUT_OF_STOCK', 'Not enough stock available.');
      return new AppError('VALIDATION_ERROR', 'The request violates a data rule.', err.constraint ? { constraint: err.constraint } : undefined);
    case '22P02':
    case '22007':
    case '22008':
    case '22003':
      return new AppError('VALIDATION_ERROR', 'Malformed identifier, date or number.');
    default:
      return null;
  }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let appErr: AppError;
  if (err instanceof AppError) appErr = err;
  else if (err instanceof ZodError)
    appErr = new AppError('VALIDATION_ERROR', 'Request validation failed.', err.flatten());
  else if (err instanceof MulterError)
    appErr =
      err.code === 'LIMIT_FILE_SIZE'
        ? new AppError('PAYLOAD_TOO_LARGE', 'File is too large.')
        : new AppError('VALIDATION_ERROR', `Upload error: ${err.message}`);
  else if (err?.type === 'entity.parse.failed') appErr = new AppError('VALIDATION_ERROR', 'Malformed JSON body.');
  else if (err?.type === 'entity.too.large') appErr = new AppError('PAYLOAD_TOO_LARGE', 'Request body is too large.');
  else appErr = fromPostgres(err) ?? new AppError('INTERNAL_ERROR', 'Something went wrong. Please try again.');

  if (appErr.status >= 500) logger.error({ err, requestId: req.id, route: req.originalUrl }, 'unhandled error');
  else if (!(err instanceof AppError)) logger.warn({ code: appErr.code, pgCode: err?.code, requestId: req.id }, 'request rejected');

  res.status(appErr.status).json({
    success: false,
    error: {
      code: appErr.code,
      message: appErr.message,
      ...(appErr.details !== undefined ? { details: appErr.details } : {}),
      requestId: req.id,
    },
  });
};
