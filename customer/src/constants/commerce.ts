import type { ShippingMethod } from '@/types';

/**
 * Currency configuration. Prices in mock data are stored in the base currency
 * (Djiboutian franc, no minor units). Switch `code`/`locale` here to change
 * how prices render everywhere.
 */
export const CURRENCY = {
  code: 'DJF',
  locale: 'en-US',
  fractionDigits: 0,
} as const;

/**
 * Commercial rules below are placeholders for the demo storefront.
 * Final values must come from the backend / business once confirmed.
 */
export const FREE_SHIPPING_THRESHOLD = 25000;

export const SHIPPING_METHODS: ShippingMethod[] = [
  {
    id: 'standard',
    name: 'Standard Delivery',
    description: 'Delivered to your door across Djibouti City.',
    price: 1000,
    eta: [2, 4],
  },
  {
    id: 'express',
    name: 'Express Delivery',
    description: 'Priority dispatch for next-day delivery in Djibouti City.',
    price: 2500,
    eta: [1, 1],
  },
  {
    id: 'pickup',
    name: 'Store Pickup',
    description: 'Collect from SPORTX, Place Menelik.',
    price: 0,
    eta: [1, 2],
  },
];

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

export const MAX_QUANTITY_PER_LINE = 10;

export const LOW_STOCK_THRESHOLD = 5;

export const PRODUCTS_PAGE_SIZE = 12;
