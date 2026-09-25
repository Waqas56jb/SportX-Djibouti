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

/** Normalises any thrown value into a user-facing message. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
