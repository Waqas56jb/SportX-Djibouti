/**
 * Storefront presentation config only. Business rules (shipping methods and prices, the free
 * delivery threshold, coupons, tax, per-line quantity limit) come from the API:
 * `GET /store`, `GET /shipping/methods` and `POST /checkout/validate` (see services/storeService
 * and services/shippingService).
 */

/**
 * Currency formatting. Prices are stored in the base currency (Djiboutian franc, no minor
 * units). Switch `code`/`locale` here to change how prices render everywhere.
 */
export const CURRENCY = {
  code: 'DJF',
  locale: 'en-US',
  fractionDigits: 0,
} as const;

export const LAUNCH_COUNTRY = 'Djibouti';

export const COUNTRIES = [{ code: 'DJ', name: 'Djibouti' }] as const;

export const DJIBOUTI_CITIES = [
  'Djibouti City',
  'Ali Sabieh',
  'Arta',
  'Dikhil',
  'Obock',
  'Tadjourah',
] as const;

/** UI fallback for the per-line quantity cap until `GET /store` (maxQuantityPerLine) has loaded. */
export const MAX_QUANTITY_PER_LINE = 10;

/** Display hint for "only N left" copy where the API has no stock status (guest bag lines). */
export const LOW_STOCK_THRESHOLD = 5;

/** Products per catalogue page ("load more" appends the next page). */
export const PRODUCTS_PAGE_SIZE = 12;

/** Product reviews per page. */
export const REVIEWS_PAGE_SIZE = 5;
