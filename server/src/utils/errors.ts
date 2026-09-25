export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  INVALID_COUPON: 'INVALID_COUPON',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  ORDER_INVALID: 'ORDER_INVALID',
  RATE_LIMITED: 'RATE_LIMITED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  OUT_OF_STOCK: 409,
  INVALID_COUPON: 422,
  PAYMENT_FAILED: 402,
  ORDER_INVALID: 422,
  RATE_LIMITED: 429,
  EMAIL_NOT_VERIFIED: 403,
  ACCOUNT_INACTIVE: 403,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL_ERROR: 500,
};

/** Expected, user-safe error. Anything else is reported as INTERNAL_ERROR without details. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    status?: number,
  ) {
    super(message);
    this.status = status ?? STATUS[code];
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError('VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Authentication required.') => new AppError('UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have permission to perform this action.') => new AppError('FORBIDDEN', message);
export const notFound = (entity = 'Resource') => new AppError('NOT_FOUND', `${entity} not found.`);
export const conflict = (message: string, details?: unknown) => new AppError('CONFLICT', message, details);
