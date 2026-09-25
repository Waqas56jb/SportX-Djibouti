import { t, type TKey } from '@/i18n';
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

/**
 * Enum → label maps. Each property is a getter that translates on access, so
 * `CATEGORY_LABELS[slug]` always returns the current language.
 */
function translated<K extends string>(keys: Record<K, TKey>): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of Object.keys(keys) as K[]) Object.defineProperty(out, k, { enumerable: true, get: () => t(keys[k]) });
  return out;
}

export const CATEGORY_LABELS = translated<ProductCategory>({
  'football-boots': 'common.category.football-boots',
  'turf-shoes': 'common.category.turf-shoes',
  jerseys: 'common.category.jerseys',
  'team-kits': 'common.category.team-kits',
  'polo-shirts': 'common.category.polo-shirts',
  't-shirts': 'common.category.t-shirts',
  shorts: 'common.category.shorts',
  tracksuits: 'common.category.tracksuits',
  socks: 'common.category.socks',
  bags: 'common.category.bags',
  'goalkeeper-gloves': 'common.category.goalkeeper-gloves',
  balls: 'common.category.balls',
});

export const DEPARTMENT_LABELS = translated<Department>({
  footwear: 'common.department.footwear',
  apparel: 'common.department.apparel',
  equipment: 'common.department.equipment',
  accessories: 'common.department.accessories',
});

export const SPORT_LABELS = translated<Sport>({
  football: 'common.sport.football',
  basketball: 'common.sport.basketball',
  running: 'common.sport.running',
  training: 'common.sport.training',
  lifestyle: 'common.sport.lifestyle',
});

export const GENDER_LABELS = translated<Gender>({
  men: 'common.gender.men',
  women: 'common.gender.women',
  kids: 'common.gender.kids',
  unisex: 'common.gender.unisex',
});

const SORT_KEYS: { value: SortKey; key: TKey }[] = [
  { value: 'featured', key: 'common.sort.featured' },
  { value: 'newest', key: 'common.sort.newest' },
  { value: 'price-asc', key: 'common.sort.priceAsc' },
  { value: 'price-desc', key: 'common.sort.priceDesc' },
  { value: 'rating', key: 'common.sort.rating' },
  { value: 'popular', key: 'common.sort.popular' },
];

/** Sort options with labels in the current language (read at render time). */
export const getSortOptions = (): { value: SortKey; label: string }[] => SORT_KEYS.map((o) => ({ value: o.value, label: t(o.key) }));

export const ORDER_STATUS_LABELS = translated<OrderStatus>({
  pending: 'common.orderStatus.pending',
  'payment-pending': 'common.orderStatus.paymentPending',
  'payment-confirmed': 'common.orderStatus.paymentConfirmed',
  processing: 'common.orderStatus.processing',
  packed: 'common.orderStatus.packed',
  shipped: 'common.orderStatus.shipped',
  'out-for-delivery': 'common.orderStatus.outForDelivery',
  delivered: 'common.orderStatus.delivered',
  cancelled: 'common.orderStatus.cancelled',
  'refund-requested': 'common.orderStatus.refundRequested',
  refunded: 'common.orderStatus.refunded',
});

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

export const PAYMENT_STATUS_LABELS = translated<PaymentStatus>({
  pending: 'common.paymentStatus.pending',
  authorized: 'common.paymentStatus.authorized',
  paid: 'common.paymentStatus.paid',
  failed: 'common.paymentStatus.failed',
  cancelled: 'common.paymentStatus.cancelled',
  refunded: 'common.paymentStatus.refunded',
  'partially-refunded': 'common.paymentStatus.partiallyRefunded',
});

export const PAYMENT_METHOD_LABELS = translated<PaymentMethodType>({
  card: 'common.paymentMethod.card',
  'mobile-money': 'common.paymentMethod.mobileMoney',
  'cash-on-delivery': 'common.paymentMethod.cashOnDelivery',
  'bank-transfer': 'common.paymentMethod.bankTransfer',
});

export const TICKET_STATUS_LABELS = translated<TicketStatus>({
  open: 'common.ticketStatus.open',
  'in-progress': 'common.ticketStatus.inProgress',
  'waiting-customer': 'common.ticketStatus.waitingCustomer',
  resolved: 'common.ticketStatus.resolved',
  closed: 'common.ticketStatus.closed',
});

export const TICKET_CATEGORY_LABELS = translated<TicketCategory>({
  order: 'common.ticketCategory.order',
  delivery: 'common.ticketCategory.delivery',
  returns: 'common.ticketCategory.returns',
  payment: 'common.ticketCategory.payment',
  product: 'common.ticketCategory.product',
  account: 'common.ticketCategory.account',
  other: 'common.ticketCategory.other',
});
