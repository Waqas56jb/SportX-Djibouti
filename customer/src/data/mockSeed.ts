/**
 * Seed records for the mock backend (services/mock/db.ts). These only exist
 * so the account area has realistic content before the API is connected.
 */
import type { Address, Coupon, Order, OrderItem, OrderStatus, Review, SupportTicket, User } from '@/types';
import { ORDER_FLOW } from '@/constants/labels';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_METHODS } from '@/constants/commerce';
import { PRODUCTS } from './products';

export const DEMO_CREDENTIALS = { email: 'demo@example.com', password: 'sportx123' };

export const DEMO_USER: User = {
  id: 'usr_demo',
  firstName: 'Hodan',
  lastName: 'Ali',
  email: DEMO_CREDENTIALS.email,
  phone: '+253 77 00 00 00',
  createdAt: '2026-01-14T09:00:00.000Z',
  marketingOptIn: true,
};

export const SEED_ADDRESSES: Address[] = [
  {
    id: 'adr_home',
    label: 'Home',
    firstName: 'Hodan',
    lastName: 'Ali',
    phone: '+253 77 00 00 00',
    line1: 'Sample address line 1',
    line2: 'Apartment 4',
    city: 'Djibouti City',
    country: 'Djibouti',
    isDefault: true,
  },
  {
    id: 'adr_work',
    label: 'Work',
    firstName: 'Hodan',
    lastName: 'Ali',
    phone: '+253 77 00 00 00',
    line1: 'Sample office address',
    city: 'Djibouti City',
    country: 'Djibouti',
    isDefault: false,
  },
];

export const COUPONS: Coupon[] = [
  { code: 'WELCOME10', description: '10% off your order', type: 'percentage', value: 10 },
  { code: 'TEAM5000', description: '5,000 DJF off orders over 40,000 DJF', type: 'fixed', value: 5000, minSubtotal: 40000 },
];

const byId = (id: string) => {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) throw new Error(`Seed product ${id} missing`);
  return p;
};

function item(productId: string, colorIdx: number, sizeIdx: number, quantity: number): OrderItem {
  const p = byId(productId);
  const color = p.colors[colorIdx] ?? p.colors[0];
  const size = p.sizes[sizeIdx] ?? p.sizes[0];
  const variant = p.variants.find((v) => v.color === color.name && v.size === size) ?? p.variants[0];
  return {
    id: `${variant.id}-line`,
    productId: p.id,
    variantId: variant.id,
    slug: p.slug,
    name: p.name,
    image: p.images[color.imageIndex ?? 0]?.url ?? p.images[0].url,
    color: color.name,
    size,
    quantity,
    unitPrice: p.price,
    compareAtPrice: p.compareAtPrice,
  };
}

function timelineUntil(status: OrderStatus, start: string) {
  const t0 = new Date(start).getTime();
  if (status === 'cancelled') {
    return [
      { status: 'created' as const, date: new Date(t0).toISOString() },
      { status: 'cancelled' as const, date: new Date(t0 + 3 * 3600000).toISOString() },
    ];
  }
  const upto = ORDER_FLOW.indexOf(status);
  const gaps = [0, 0.2, 6, 20, 30, 70, 76];
  return ORDER_FLOW.slice(0, upto + 1).map((s, i) => ({ status: s, date: new Date(t0 + gaps[i] * 3600000).toISOString() }));
}

function order(
  number: string,
  status: OrderStatus,
  createdAt: string,
  items: OrderItem[],
  methodId: string,
  payment: Order['payment']['method'],
): Order {
  const method = SHIPPING_METHODS.find((m) => m.id === methodId) ?? SHIPPING_METHODS[0];
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : method.price;
  const total = subtotal + shippingCost;
  const id = `ord_${number.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const expected = new Date(new Date(createdAt).getTime() + method.eta[1] * 86400000).toISOString();
  return {
    id,
    number,
    userId: DEMO_USER.id,
    customer: { firstName: DEMO_USER.firstName, lastName: DEMO_USER.lastName, email: DEMO_USER.email, phone: DEMO_USER.phone },
    items,
    shipping: {
      method,
      address: {
        firstName: DEMO_USER.firstName,
        lastName: DEMO_USER.lastName,
        phone: DEMO_USER.phone,
        line1: SEED_ADDRESSES[0].line1,
        line2: SEED_ADDRESSES[0].line2,
        city: 'Djibouti City',
        country: 'Djibouti',
      },
      expectedDelivery: expected,
    },
    payment: {
      id: `pay_${id}`,
      orderId: id,
      method: payment,
      status: status === 'cancelled' ? 'refunded' : payment === 'cash-on-delivery' && status !== 'delivered' ? 'pending' : 'paid',
      amount: total,
      currency: 'DJF',
      reference: payment === 'card' ? '•••• 4242' : undefined,
      createdAt,
    },
    status,
    timeline: timelineUntil(status, createdAt),
    subtotal,
    discount: 0,
    shippingCost,
    total,
    createdAt,
  };
}

export const SEED_ORDERS: Order[] = [
  order('SPX-260923-1048', 'processing', '2026-09-23T10:12:00.000Z', [item('sx-rn-001', 0, 3, 1), item('sx-rn-005', 0, 2, 1)], 'express', 'card'),
  order('SPX-260919-7731', 'out-for-delivery', '2026-09-19T15:40:00.000Z', [item('sx-tr-003', 2, 3, 1)], 'standard', 'mobile-money'),
  order(
    'SPX-260812-3390',
    'delivered',
    '2026-08-12T08:05:00.000Z',
    [item('sx-fb-001', 0, 3, 1), item('sx-fb-003', 0, 2, 2), item('sx-fb-006', 0, 1, 2)],
    'standard',
    'card',
  ),
  order('SPX-260702-5512', 'cancelled', '2026-07-02T18:22:00.000Z', [item('sx-ac-001', 1, 0, 1)], 'pickup', 'cash-on-delivery'),
  order('SPX-260528-2204', 'delivered', '2026-05-28T12:30:00.000Z', [item('sx-tr-001', 0, 2, 2), item('sx-tr-002', 1, 2, 1)], 'pickup', 'cash-on-delivery'),
];

export const SEED_USER_REVIEWS: Review[] = [
  {
    id: 'rev_demo_1',
    productId: 'sx-tr-001',
    userId: DEMO_USER.id,
    author: 'Hodan A.',
    rating: 5,
    title: 'Perfect training layer',
    body: 'Light, dries quickly and the fit is spot on. I have washed it many times and it still looks new.',
    createdAt: '2026-06-10T10:00:00.000Z',
    verified: true,
    size: 'M',
    fit: 'true',
  },
  {
    id: 'rev_demo_2',
    productId: 'sx-tr-002',
    userId: DEMO_USER.id,
    author: 'Hodan A.',
    rating: 4,
    title: 'Great shorts, zip pocket is handy',
    body: 'Comfortable and stretchy for squats and sprints. Would love a longer inseam option.',
    createdAt: '2026-06-12T10:00:00.000Z',
    verified: true,
    size: 'M',
    fit: 'true',
  },
];

export const SEED_TICKETS: SupportTicket[] = [
  {
    id: 'tkt_1021',
    number: 'TCK-1021',
    userId: DEMO_USER.id,
    subject: 'Exchange boots for a larger size',
    category: 'returns',
    orderNumber: 'SPX-260812-3390',
    status: 'resolved',
    createdAt: '2026-08-18T09:00:00.000Z',
    updatedAt: '2026-08-19T14:10:00.000Z',
    messages: [
      {
        id: 'm1',
        author: 'customer',
        authorName: 'Hodan Ali',
        body: 'Hi, the Pro Elite Boots are slightly tight. Can I exchange them for EU 43?',
        createdAt: '2026-08-18T09:00:00.000Z',
      },
      {
        id: 'm2',
        author: 'support',
        authorName: 'SPORTX Support',
        body: 'Hello Hodan, of course. EU 43 is reserved for you — bring the boots unworn in the original box to our store at Place Menelik and we will swap them.',
        createdAt: '2026-08-18T11:30:00.000Z',
      },
      {
        id: 'm3',
        author: 'customer',
        authorName: 'Hodan Ali',
        body: 'Done, thank you for the quick help!',
        createdAt: '2026-08-19T14:10:00.000Z',
      },
    ],
  },
  {
    id: 'tkt_1047',
    number: 'TCK-1047',
    userId: DEMO_USER.id,
    subject: 'Delivery time for tracksuit order',
    category: 'delivery',
    orderNumber: 'SPX-260919-7731',
    status: 'in-progress',
    createdAt: '2026-09-21T16:00:00.000Z',
    updatedAt: '2026-09-22T09:15:00.000Z',
    messages: [
      {
        id: 'm1',
        author: 'customer',
        authorName: 'Hodan Ali',
        body: 'Hello, could you confirm when my tracksuit will be delivered? I need it for a tournament this weekend.',
        createdAt: '2026-09-21T16:00:00.000Z',
      },
      {
        id: 'm2',
        author: 'support',
        authorName: 'SPORTX Support',
        body: 'Thanks for reaching out. Your order is with our delivery team and scheduled for delivery before the weekend. We will update you as soon as it is out for delivery.',
        createdAt: '2026-09-22T09:15:00.000Z',
      },
    ],
  },
];
