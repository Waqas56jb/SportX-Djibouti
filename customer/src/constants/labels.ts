import type {
  Department,
  Gender,
  OrderStatus,
  PaymentMethodType,
  PaymentStatus,
  ProductCategory,
  SortKey,
  Sport,
  TicketCategory,
  TicketStatus,
} from '@/types';

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  'football-boots': 'Football Boots',
  'basketball-shoes': 'Basketball Shoes',
  'running-shoes': 'Running Shoes',
  'training-shoes': 'Training Shoes',
  'lifestyle-shoes': 'Lifestyle Shoes',
  jerseys: 'Jerseys',
  tees: 'T-Shirts & Tops',
  shorts: 'Shorts',
  tracksuits: 'Tracksuits',
  hoodies: 'Hoodies & Sweatshirts',
  jackets: 'Jackets',
  leggings: 'Leggings & Tights',
  'sports-bras': 'Sports Bras',
  balls: 'Balls',
  gloves: 'Gloves',
  socks: 'Socks',
  caps: 'Caps & Headwear',
  bags: 'Bags & Backpacks',
  'gym-equipment': 'Gym Equipment',
  wearables: 'Wearables',
};

export const DEPARTMENT_LABELS: Record<Department, string> = {
  footwear: 'Footwear',
  apparel: 'Apparel',
  equipment: 'Equipment',
  accessories: 'Accessories',
};

export const SPORT_LABELS: Record<Sport, string> = {
  football: 'Football',
  basketball: 'Basketball',
  running: 'Running',
  training: 'Training',
  lifestyle: 'Lifestyle',
};

export const GENDER_LABELS: Record<Gender, string> = {
  men: 'Men',
  women: 'Women',
  kids: 'Kids',
  unisex: 'Unisex',
};

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Best Rated' },
  { value: 'popular', label: 'Most Popular' },
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  created: 'Order Created',
  'payment-confirmed': 'Payment Confirmed',
  processing: 'Processing',
  packed: 'Packed',
  shipped: 'Shipped',
  'out-for-delivery': 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** The fulfilment pipeline in order — used to render timelines. */
export const ORDER_FLOW: OrderStatus[] = [
  'created',
  'payment-confirmed',
  'processing',
  'packed',
  'shipped',
  'out-for-delivery',
  'delivered',
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  card: 'Credit / Debit Card',
  'mobile-money': 'Mobile Money',
  'cash-on-delivery': 'Cash on Delivery',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  'in-progress': 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  order: 'Order',
  delivery: 'Delivery',
  returns: 'Returns & Exchanges',
  payment: 'Payment',
  product: 'Product',
  account: 'Account',
  other: 'Other',
};
