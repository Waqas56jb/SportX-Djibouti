import type { Customer, Order, OrderItem, OrderStatus, OrderTimelineEvent, PaymentMethod, PaymentStatus, ShippingStatus } from '@/types';
import { customers } from './people';
import { products } from './catalog';
import { addMinutes, createRng, daysAgo } from './seed';

const rng = createRng(10245);

// Newest first. 5 pending + 7 processing = 12 orders needing action.
const STATUS_SEQUENCE: OrderStatus[] = [
  'pending', 'pending', 'processing', 'pending', 'processing', 'processing', 'pending', 'processing', 'processing', 'pending',
  'processing', 'packed', 'processing', 'packed', 'packed', 'shipped', 'packed', 'shipped', 'out_for_delivery', 'shipped',
  'cancelled', 'shipped', 'out_for_delivery', 'shipped', 'delivered', 'refunded', 'delivered', 'delivered', 'delivered', 'delivered',
  'delivered', 'cancelled', 'delivered', 'delivered', 'refunded', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered',
  'delivered', 'cancelled', 'delivered', 'delivered', 'delivered',
];

const SHIPPING_METHODS = [
  { name: 'Standard Delivery — Djibouti City', cost: 500, days: 2 },
  { name: 'Express Same-Day — Djibouti City', cost: 1500, days: 0 },
  { name: 'Regional Delivery', cost: 2000, days: 4 },
  { name: 'Store Pickup — Place Menelik', cost: 0, days: 0 },
];

const COUPONS = [
  { code: 'WELCOME10', pct: 10 },
  { code: 'MATCHDAY15', pct: 15 },
  { code: 'RUNCLUB', pct: 10 },
];

const published = products.filter((p) => p.status === 'published');

// Customer selection weighted so a few customers are clearly "high value / returning".
const CUSTOMER_POOL = [
  ...customers.slice(0, 22),
  customers[20], customers[20], customers[20], // John Mercer — repeat buyer
  customers[4], customers[4], customers[8], customers[8], customers[11], customers[15], customers[15], customers[29], customers[30],
].filter((c) => c.status !== 'blocked');

function buildItems(orderId: string): OrderItem[] {
  const count = rng.chance(0.45) ? 1 : rng.chance(0.6) ? 2 : rng.int(3, 4);
  const chosen = rng.sample(published, count);
  return chosen.map((p, idx) => {
    const v = rng.pick(p.variants);
    const qty = p.type === 'socks' || p.type === 'apparel' ? rng.int(1, 3) : rng.chance(0.85) ? 1 : 2;
    const unit = v.price ?? p.price;
    return {
      id: `${orderId}_it${idx + 1}`,
      productId: p.id,
      variantId: v.id,
      productName: p.name,
      productType: p.type,
      variantLabel: `${v.color} / ${v.size}`,
      sku: v.sku,
      image: p.images[0]?.url,
      quantity: qty,
      unitPrice: unit,
      subtotal: unit * qty,
    };
  });
}

function paymentFor(status: OrderStatus, method: PaymentMethod, idx: number): PaymentStatus {
  if (idx === 6) return 'failed';
  if (idx === 26 || idx === 35) return 'refund_pending';
  if (idx === 34) return 'partially_refunded';
  switch (status) {
    case 'pending':
      return method === 'card' ? 'authorized' : 'pending';
    case 'cancelled':
      return idx === 20 ? 'refunded' : 'failed';
    case 'refunded':
      return 'refunded';
    case 'shipped':
    case 'out_for_delivery':
    case 'packed':
    case 'processing':
      return method === 'cash_on_delivery' ? 'pending' : 'paid';
    default:
      return 'paid';
  }
}

function shippingStatusFor(status: OrderStatus): ShippingStatus {
  switch (status) {
    case 'packed':
      return 'label_created';
    case 'shipped':
      return 'in_transit';
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'delivered':
      return 'delivered';
    case 'refunded':
      return 'returned';
    default:
      return 'not_shipped';
  }
}

const ADMINS = ['Kadra Youssouf', 'Omar Farah', 'Hodan Abdillahi'];

function buildTimeline(orderId: string, status: OrderStatus, created: string, payment: PaymentStatus, method: PaymentMethod): OrderTimelineEvent[] {
  const ev: OrderTimelineEvent[] = [];
  let t = created;
  let n = 0;
  const push = (kind: OrderTimelineEvent['kind'], title: string, actorType: OrderTimelineEvent['actorType'], gap: number, description?: string) => {
    t = addMinutes(t, gap);
    if (new Date(t).getTime() > Date.now()) t = new Date(Date.now() - 60_000 * (10 - n)).toISOString();
    ev.push({
      id: `${orderId}_ev${++n}`,
      kind,
      title,
      description,
      actor: actorType === 'system' ? 'System' : actorType === 'customer' ? 'Customer' : rng.pick(ADMINS),
      actorType,
      createdAt: t,
    });
  };
  push('created', 'Order created', 'customer', 0, 'Placed via sportx storefront');
  if (payment === 'failed') {
    push('payment_failed', 'Payment failed', 'system', 1, 'Card issuer declined the transaction');
    if (status === 'cancelled') push('cancelled', 'Order cancelled', 'system', 60 * 24, 'Auto-cancelled after unpaid for 24 hours');
    return ev;
  }
  if (method !== 'cash_on_delivery' && status !== 'pending') push('payment_confirmed', 'Payment confirmed', 'system', 2);
  if (status === 'pending') {
    if (method === 'card') push('payment_confirmed', 'Payment authorized', 'system', 2, 'Funds held, capture on dispatch');
    return ev;
  }
  if (status === 'cancelled') {
    push('cancelled', 'Order cancelled', 'admin', 180, 'Cancelled at customer request');
    if (payment === 'refunded') push('refund_completed', 'Refund completed', 'system', 45);
    return ev;
  }
  const flow: [OrderStatus, string, number][] = [
    ['processing', 'Processing', rng.int(30, 240)],
    ['packed', 'Packed', rng.int(60, 300)],
    ['shipped', 'Shipped', rng.int(60, 360)],
    ['out_for_delivery', 'Out for delivery', rng.int(600, 1200)],
    ['delivered', 'Delivered', rng.int(90, 300)],
  ];
  const target = status === 'refunded' ? 'delivered' : status;
  for (const [s, title, gap] of flow) {
    push(s, title, s === 'delivered' ? 'system' : 'admin', gap, s === 'shipped' ? 'Handed to courier' : undefined);
    if (s === target) break;
  }
  if (status === 'refunded') {
    push('refund_requested', 'Refund requested', 'customer', 60 * 30, 'Item did not fit');
    push('refunded', 'Refund completed', 'admin', 60 * 20);
  }
  if (payment === 'refund_pending') push('refund_requested', 'Refund requested', 'customer', 60 * 20, 'Customer reported a sizing issue');
  if (payment === 'partially_refunded') push('refund_completed', 'Partial refund issued', 'admin', 60 * 24, 'One item returned');
  return ev;
}

export const orders: Order[] = STATUS_SEQUENCE.map((status, idx) => {
  const number = `SPX-${10245 - idx}`;
  const id = `ord_${10245 - idx}`;
  const customer = idx === 0 ? customers[20] : rng.pick(CUSTOMER_POOL);
  const addr = customer.addresses[0];
  const regional = addr.city !== 'Djibouti';
  const ship = regional ? SHIPPING_METHODS[2] : rng.chance(0.2) ? SHIPPING_METHODS[1] : rng.chance(0.12) ? SHIPPING_METHODS[3] : SHIPPING_METHODS[0];
  const method: PaymentMethod = idx === 6 ? 'card' : rng.pick<PaymentMethod>(['card', 'card', 'mobile_money', 'mobile_money', 'cash_on_delivery']);
  const days = idx === 0 ? 0 : Math.floor(idx * 1.05 + rng.next() * 0.9);
  const created = daysAgo(days, idx === 0 ? Math.max(0, new Date().getHours() - 1) : rng.int(8, 21), rng.int(0, 59));
  const items = buildItems(id);
  const subtotal = items.reduce((s, it) => s + it.subtotal, 0);
  const coupon = rng.chance(0.22) ? rng.pick(COUPONS) : undefined;
  const discount = coupon ? Math.round((subtotal * coupon.pct) / 100) : 0;
  const shippingCost = subtotal >= 30000 && ship.cost === 500 ? 0 : ship.cost;
  const tax = Math.round((subtotal - discount) * 0.1);
  const total = subtotal - discount + shippingCost + tax;
  const payStatus = paymentFor(status, method, idx);
  const timeline = buildTimeline(id, status, created, payStatus, method);
  const shipStatus = shippingStatusFor(status);
  const shippedEv = timeline.find((e) => e.kind === 'shipped');
  const deliveredEv = timeline.find((e) => e.kind === 'delivered');
  const refundedAmount = payStatus === 'refunded' ? total : payStatus === 'partially_refunded' ? items[0].subtotal : 0;
  const cardBrand = method === 'card' ? rng.pick(['Visa', 'Mastercard']) : undefined;
  return {
    id,
    number,
    customerId: customer.id,
    customerName: `${customer.firstName} ${customer.lastName}`,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    items,
    itemsCount: items.reduce((s, it) => s + it.quantity, 0),
    subtotal,
    discount,
    couponCode: coupon?.code,
    shippingCost,
    tax,
    total,
    currency: 'DJF',
    status,
    payment: {
      id: `pay_${10245 - idx}`,
      method,
      provider: method === 'card' ? 'Stripe' : method === 'mobile_money' ? 'Mobile Money' : method === 'bank_transfer' ? 'Bank transfer' : 'Cash on delivery',
      status: payStatus,
      amount: total,
      refundedAmount,
      currency: 'DJF',
      transactionRef: method === 'cash_on_delivery' ? `COD-${10245 - idx}` : `${method === 'card' ? 'pi' : 'mm'}_${(Math.floor(rng.next() * 1e12)).toString(36).toUpperCase()}`,
      cardBrand,
      cardLast4: cardBrand ? String(rng.int(1000, 9999)) : undefined,
      paidAt: payStatus === 'paid' || payStatus === 'refunded' || payStatus === 'partially_refunded' || payStatus === 'refund_pending' ? addMinutes(created, 2) : undefined,
      failureReason: payStatus === 'failed' ? 'Card declined by issuer (insufficient funds)' : undefined,
    },
    shipping: {
      method: ship.name,
      carrier: ship.cost === 0 && ship.name.startsWith('Store') ? undefined : shippedEv || status === 'packed' ? (regional ? 'Partner courier' : 'SPORTX Courier') : undefined,
      trackingNumber: shippedEv ? `SPXD${rng.int(100000, 999999)}` : undefined,
      status: shipStatus,
      cost: shippingCost,
      estimatedDelivery: addMinutes(created, (ship.days + 1) * 24 * 60),
      shippedAt: shippedEv?.createdAt,
      deliveredAt: deliveredEv?.createdAt,
      address: {
        fullName: addr.fullName,
        phone: addr.phone,
        line1: addr.line1,
        district: addr.district,
        city: addr.city,
        country: addr.country,
        postalCode: addr.postalCode,
      },
    },
    timeline,
    refunds:
      status === 'refunded' || payStatus === 'refund_pending' || payStatus === 'partially_refunded'
        ? [
            {
              id: `rf_${10245 - idx}`,
              orderId: id,
              amount: status === 'refunded' ? total : items[0].subtotal,
              reason: status === 'refunded' ? 'customer_request' : payStatus === 'partially_refunded' ? 'damaged_item' : 'wrong_item',
              status: payStatus === 'refund_pending' ? 'requested' : 'completed',
              requestedBy: payStatus === 'refund_pending' ? 'Customer' : 'Kadra Youssouf',
              createdAt: timeline[timeline.length - 1].createdAt,
            },
          ]
        : [],
    customerNote: idx % 9 === 2 ? 'Please call before delivery.' : undefined,
    createdAt: created,
    updatedAt: timeline[timeline.length - 1].createdAt,
  };
});

// ─── Derive customer aggregates from orders ──────────────────────────────────
const now = Date.now();
for (const c of customers) {
  const own = orders.filter((o) => o.customerId === c.id && o.status !== 'cancelled');
  c.ordersCount = own.length;
  c.totalSpent = own.reduce((s, o) => s + o.total - o.payment.refundedAmount, 0);
  c.averageOrder = own.length ? Math.round(c.totalSpent / own.length) : 0;
  c.lastOrderAt = own.map((o) => o.createdAt).sort().at(-1);
  const groups: Customer['groups'] = ['all'];
  if (now - new Date(c.joinedAt).getTime() < 30 * 86_400_000) groups.push('new');
  if (own.length >= 2) groups.push('returning');
  if (c.totalSpent >= 80_000) groups.push('high_value');
  const lastActivity = new Date(c.lastOrderAt ?? c.joinedAt).getTime();
  if (c.status === 'inactive' || now - lastActivity > 60 * 86_400_000) groups.push('inactive');
  c.groups = groups;
  c.wishlistProductIds = published.filter((_, i) => (i + c.id.length * 3 + Number(c.id.slice(-2))) % 11 === 0).slice(0, 5).map((p) => p.id);
}

