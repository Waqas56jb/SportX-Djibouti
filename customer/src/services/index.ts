import { t } from '@/i18n';
import { ApiError, localizeApiError } from './api';

export { productService } from './productService';
export { authService } from './authService';
export { cartService } from './cartService';
export { orderService } from './orderService';
export { addressService } from './addressService';
export { reviewService } from './reviewService';
export { supportService } from './supportService';
export { wishlistService } from './wishlistService';
export { paymentService } from './paymentService';
export { marketingService } from './marketingService';
export { ApiError } from './api/client';

/**
 * Normalises any thrown value into a user-facing message in the current language. API errors are
 * localised by code/message (see `localizeApiError`); pass an already-translated `fallback`.
 */
export function errorMessage(error: unknown, fallback?: string): string {
  if (error instanceof ApiError) return localizeApiError(error, fallback);
  if (error instanceof Error && error.message) return error.message;
  return fallback ?? t('common.errors.generic');
}
