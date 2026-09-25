import type { ActivityLog, NotificationPreference, PaymentProvider, ShippingZone, StockMovement, StoreSettings } from '@/types';
import { BRAND } from '@/constants/brand';
import { products } from './catalog';
import { adminUsers } from './people';
import { orders } from './orders';
import { createRng, daysAgo } from './seed';

const rng = createRng(9001);

/** Only details supplied by the client are pre-filled. Everything else is left for the store owner. */
export const storeSettings: StoreSettings = {
  storeName: BRAND.name,
  tagline: BRAND.tagline,
  email: '',
  phone: BRAND.phone,
  addressLine1: 'PLACE MENELIK',
  addressLine2: 'RUE DE RAS MAKONNEN',
  city: 'DJIBOUTI',
  country: 'Djibouti',
  currency: 'DJF',
  timezone: 'Africa/Djibouti',
  taxRate: 10,
  lowStockDefault: 5,
};

export const shippingZones: ShippingZone[] = [
  {
    id: 'zone_djibouti_city',
    name: 'Djibouti City',
    regions: ['Djibouti', 'Balbala'],
    enabled: true,
    methods: [
      { id: 'shm_std', zoneId: 'zone_djibouti_city', name: 'Standard Delivery', description: 'Delivered by SPORTX Courier within Djibouti City.', price: 500, freeShippingThreshold: 30000, estimatedDelivery: '1–2 business days', enabled: true },
      { id: 'shm_exp', zoneId: 'zone_djibouti_city', name: 'Express Same-Day', description: 'Order before 14:00 for same-day delivery.', price: 1500, estimatedDelivery: 'Same day', enabled: true },
      { id: 'shm_pickup', zoneId: 'zone_djibouti_city', name: 'Store Pickup — Place Menelik', description: 'Collect from the SPORTX store, Place Menelik, Rue de Ras Makonnen.', price: 0, estimatedDelivery: 'Ready in 2 hours', enabled: true },
    ],
  },
  {
    id: 'zone_regions',
    name: 'Djibouti — Regions',
    regions: ['Ali Sabieh', 'Tadjourah', 'Dikhil', 'Arta', 'Obock'],
    enabled: true,
    methods: [
      { id: 'shm_reg', zoneId: 'zone_regions', name: 'Regional Delivery', description: 'Delivered by partner courier.', price: 2000, freeShippingThreshold: 60000, estimatedDelivery: '3–5 business days', enabled: true },
      { id: 'shm_reg_exp', zoneId: 'zone_regions', name: 'Regional Priority', description: 'Priority handling for regional orders.', price: 3500, estimatedDelivery: '2–3 business days', enabled: false },
    ],
  },
];

/**
 * Payment provider configuration placeholders. Secret values are NEVER stored in the frontend;
 * the backend returns only whether a secret is set and a masked hint.
 */
export const paymentProviders: PaymentProvider[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Card payments (Visa, Mastercard). Secret key and webhook secret are stored server-side only.',
    enabled: true,
    mode: 'test',
    configured: false,
    fields: [
      { key: 'publishableKey', label: 'Publishable key', secret: false, value: '', placeholder: 'pk_test_…', help: 'Public key used by the storefront checkout.' },
      { key: 'secretKey', label: 'Secret key', secret: true, value: '', placeholder: 'Stored on server — never shown', help: 'Set via the server environment (STRIPE_SECRET_KEY).' },
      { key: 'webhookSecret', label: 'Webhook signing secret', secret: true, value: '', placeholder: 'Stored on server — never shown', help: 'Set via the server environment (STRIPE_WEBHOOK_SECRET).' },
    ],
  },
  {
    id: 'mobile_money',
    name: 'Mobile Money',
    description: 'Local mobile wallet payments. Provider integration to be confirmed with SPORTX.',
    enabled: true,
    mode: 'test',
    configured: false,
    fields: [
      { key: 'merchantId', label: 'Merchant ID', secret: false, value: '', placeholder: 'Provided by the wallet operator' },
      { key: 'apiKey', label: 'API key', secret: true, value: '', placeholder: 'Stored on server — never shown' },
      { key: 'callbackUrl', label: 'Callback URL', secret: false, value: '', placeholder: 'https://api.your-domain/webhooks/mobile-money' },
    ],
  },
  {
    id: 'cash_on_delivery',
    name: 'Cash on Delivery',
    description: 'Customer pays the courier on delivery. Available in Djibouti City.',
    enabled: true,
    mode: 'live',
    configured: true,
    fields: [{ key: 'maxOrder', label: 'Maximum order value (DJF)', secret: false, value: '150000', placeholder: 'e.g. 150000' }],
  },
  {
    id: 'bank_transfer',
    name: 'Bank Transfer',
    description: 'Manual bank transfer for business and team orders.',
    enabled: false,
    mode: 'live',
    configured: false,
    fields: [
      { key: 'bankName', label: 'Bank name', secret: false, value: '', placeholder: 'Bank name' },
      { key: 'iban', label: 'Account / IBAN', secret: true, value: '', placeholder: 'Stored on server — never shown' },
    ],
  },
];

export const notificationPreferences: NotificationPreference[] = [
  { event: 'new_order', label: 'New order', description: 'A customer places an order.', channels: { email: true, sms: false, in_app: true } },
  { event: 'payment_failed', label: 'Payment failure', description: 'A payment is declined or fails to capture.', channels: { email: true, sms: true, in_app: true } },
  { event: 'low_stock', label: 'Low stock', description: 'A variant falls below its low-stock threshold.', channels: { email: true, sms: false, in_app: true } },
  { event: 'refund_requested', label: 'Refund request', description: 'A customer requests a refund.', channels: { email: true, sms: false, in_app: true } },
  { event: 'new_customer', label: 'New customer', description: 'A new customer account is created.', channels: { email: false, sms: false, in_app: true } },
  { event: 'review_pending', label: 'New review', description: 'A review is submitted and awaits moderation.', channels: { email: false, sms: false, in_app: true } },
  { event: 'new_ticket', label: 'Support ticket', description: 'A new support ticket is opened or escalated.', channels: { email: true, sms: true, in_app: true } },
];

// ─── Stock movements ────────────────────────────────────────────────────────
const MOVEMENT_ADMINS = adminUsers.filter((a) => a.status === 'active' && ['role_super_admin', 'role_product_manager', 'role_store_manager'].includes(a.roleId));

export const stockMovements: StockMovement[] = (() => {
  const list: StockMovement[] = [];
  const pool = products.filter((p) => p.status === 'published');
  for (let i = 0; i < 48; i++) {
    const p = pool[(i * 11 + 5) % pool.length];
    const v = p.variants[(i * 3) % p.variants.length];
    const kind = i % 6;
    const action: StockMovement['action'] = kind === 0 || kind === 3 ? 'add' : kind === 1 ? 'sale' : kind === 2 ? 'remove' : kind === 4 ? 'return' : 'set';
    const reason: StockMovement['reason'] =
      action === 'add' ? 'restock' : action === 'sale' ? 'sale_adjustment' : action === 'remove' ? 'damaged' : action === 'return' ? 'returned' : 'manual_correction';
    const qty = action === 'add' ? rng.int(10, 30) : action === 'sale' ? -rng.int(1, 3) : action === 'remove' ? -rng.int(1, 2) : action === 'return' ? 1 : rng.int(-3, 3) || 1;
    const newStock = v.stock;
    const previous = Math.max(0, newStock - qty);
    const admin = action === 'sale' ? { id: 'system', name: 'System' } : rng.pick(MOVEMENT_ADMINS);
    list.push({
      id: `mov_${String(i + 1).padStart(4, '0')}`,
      variantId: v.id,
      productId: p.id,
      productName: p.name,
      variantLabel: `${v.color} / ${v.size}`,
      sku: v.sku,
      action,
      quantity: newStock - previous,
      previousStock: previous,
      newStock,
      reason,
      notes: action === 'remove' ? 'Box damaged in storage' : action === 'set' ? 'Cycle count correction' : action === 'add' ? 'Supplier delivery' : undefined,
      adminId: admin.id,
      adminName: admin.name,
      createdAt: daysAgo(Math.floor(i * 1.3), rng.int(8, 19), rng.int(0, 59)),
    });
  }
  return list;
})();

// ─── Activity log ───────────────────────────────────────────────────────────
type ActDef = [admin: number, action: string, module: string, record: string, link: string | undefined, days: number, status?: 'failed'];
const ACTS: ActDef[] = [
  [3, 'Order status updated', 'Orders', `${orders[2].number} → Processing`, `/orders/${orders[2].id}`, 0],
  [0, 'Admin signed in', 'Auth', 'admin@sportx.demo', undefined, 0],
  [2, 'Stock adjusted', 'Inventory', 'SPX-FW-1001-BLK-42 (+12)', '/inventory/movements', 0],
  [4, 'Ticket replied', 'Support', 'TKT-1039', '/support/tkt_1039', 0],
  [1, 'Coupon created', 'Marketing', 'TEAMKIT', '/discounts/coupons', 5],
  [2, 'Product updated', 'Products', 'Nike Pegasus 41', '/products/prd_1013', 1],
  [3, 'Tracking number added', 'Orders', `${orders[15].number}`, `/orders/${orders[15].id}`, 1],
  [4, 'Review approved', 'Reviews', 'Review on Adidas UCL Pro Match Ball', '/reviews', 1],
  [0, 'Role permissions updated', 'Settings', 'Order Manager', '/settings/roles', 2],
  [1, 'Campaign paused', 'Marketing', 'Train Hard — Gym Essentials', '/marketing/campaigns', 1],
  [3, 'Refund requested', 'Orders', `${orders[26].number}`, `/orders/${orders[26].id}`, 1],
  [2, 'Product created', 'Products', 'Puma Suede Classic XXI', '/products/prd_1051', 3],
  [4, 'Customer updated', 'Customers', 'Aicha Moussa', '/customers/cus_004', 3],
  [0, 'Customer deactivated', 'Customers', 'Neima Doualeh', '/customers/cus_025', 4],
  [5, 'Order status updated', 'Orders', `${orders[17].number} → Shipped`, `/orders/${orders[17].id}`, 4],
  [1, 'Flash sale created', 'Marketing', 'Hoops Night', '/discounts/flash-sales', 1],
  [0, 'Admin invited', 'Settings', 'samira.ismael@sportx.demo', '/settings/admin-users', 6],
  [2, 'Category updated', 'Catalog', 'Football Boots', '/categories', 7],
  [3, 'Order cancelled', 'Orders', `${orders[20].number}`, `/orders/${orders[20].id}`, 8],
  [0, 'Payment settings viewed', 'Settings', 'Stripe', '/settings/payments', 9],
  [6, 'Admin sign-in failed', 'Auth', 'omar.farah@sportx.demo', undefined, 3, 'failed'],
  [2, 'Stock adjusted', 'Inventory', 'SPX-BL-1045-ORG-7 (set 0)', '/inventory/movements', 2],
  [1, 'Discount created', 'Marketing', 'Puma football boots', '/discounts/automatic', 7],
  [4, 'Customer blocked', 'Customers', 'Zahra Osman', '/customers/cus_014', 12],
  [2, 'Product archived', 'Products', 'Mizuno Wave Rider 27', '/products/prd_1052', 14],
  [0, 'Store settings updated', 'Settings', 'Tax rate 10%', '/settings/store', 20],
];

export const activityLogs: ActivityLog[] = ACTS.map(([a, action, module, record, link, days, status], i) => {
  const admin = adminUsers[a === 6 ? 5 : a];
  return {
    id: `act_${String(i + 1).padStart(4, '0')}`,
    adminId: admin.id,
    adminName: admin.name,
    action,
    module,
    record,
    recordLink: link,
    ipAddress: `203.0.113.${(i * 29) % 254 + 1}`,
    status: (status ?? 'success') as ActivityLog['status'],
    createdAt: daysAgo(days, Math.max(7, 17 - (i % 10)), (i * 13) % 60),
  };
}).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
