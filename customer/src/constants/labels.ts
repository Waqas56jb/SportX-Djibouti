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
  pending: 'Order Placed',
  'payment-pending': 'Awaiting Payment',
  'payment-confirmed': 'Payment Confirmed',
  processing: 'Processing',
  packed: 'Packed',
  shipped: 'Shipped',
  'out-for-delivery': 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  'refund-requested': 'Refund Requested',
  refunded: 'Refunded',
};

/** The fulfilment pipeline in order — used to render timelines. */
export const ORDER_FLOW: OrderStatus[] = [
  'pending',
  'payment-confirmed',
  'processing',
  'packed',
  'shipped',
  'out-for-delivery',
  'delivered',
];

/** Terminal / off-pipeline statuses rendered as a plain event list. */
export const ORDER_EXCEPTION_STATUSES: OrderStatus[] = ['cancelled', 'refund-requested', 'refunded'];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  authorized: 'Authorised',
  paid: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  'partially-refunded': 'Partially refunded',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  card: 'Credit / Debit Card',
  'mobile-money': 'Mobile Money',
  'cash-on-delivery': 'Cash on Delivery',
  'bank-transfer': 'Bank Transfer',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  'in-progress': 'In Progress',
  'waiting-customer': 'Awaiting your reply',
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
