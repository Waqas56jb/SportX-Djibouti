import { FREE_SHIPPING_THRESHOLD, SHIPPING_METHODS } from '@/constants/commerce';
import { PRODUCTS } from '@/data/products';
import type { CartItem, Coupon, Order, PlaceOrderPayload } from '@/types';
import { couponDiscount } from '@/utils/cart';
import { addBusinessDays, orderNumber, uid } from '@/utils/id';
import { apiClient } from './api/client';
import { USE_MOCK_API } from './config';
import { MockError, db, delay } from './mock/db';

export interface CreateOrderInput extends PlaceOrderPayload {
  items: CartItem[];
  coupon: Coupon | null;
  userId: string | null;
}

export const orderService = {
  async create(input: CreateOrderInput): Promise<Order> {
    if (!USE_MOCK_API) return apiClient.post<Order>('/orders', input);
    await delay(500, 900);

    // Server-side style re-validation — never trust client totals.
    input.items.forEach((item) => {
      const variant = PRODUCTS.find((p) => p.id === item.productId)?.variants.find((v) => v.id === item.variantId);
      if (!variant || variant.stock < item.quantity) {
        throw new MockError(`${item.name} (${item.size}) no longer has enough stock. Please review your bag.`, 409);
      }
    });

    const method = SHIPPING_METHODS.find((m) => m.id === input.shippingMethodId) ?? SHIPPING_METHODS[0];
    const subtotal = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const discount = couponDiscount(input.coupon, subtotal);
    const shippingCost = subtotal - discount >= FREE_SHIPPING_THRESHOLD ? 0 : method.price;
    const total = subtotal - discount + shippingCost;
    const now = new Date();
    const id = uid('ord');
    const paid = input.paymentMethod !== 'cash-on-delivery';

    const order: Order = {
      id,
      number: orderNumber(now),
      userId: input.userId,
      customer: input.contact,
      items: input.items.map((i) => ({
        id: uid('itm'),
        productId: i.productId,
        variantId: i.variantId,
        slug: i.slug,
        name: i.name,
        image: i.image,
        color: i.color,
        size: i.size,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        compareAtPrice: i.compareAtPrice,
      })),
      shipping: {
        method,
        address: {
          firstName: input.contact.firstName,
          lastName: input.contact.lastName,
          phone: input.contact.phone,
          line1: input.address.line1,
          line2: input.address.line2 || undefined,
          city: input.address.city,
          country: input.address.country,
          postalCode: input.address.postalCode || undefined,
        },
        expectedDelivery: addBusinessDays(now, method.eta[1]).toISOString(),
      },
      payment: {
        id: uid('pay'),
        orderId: id,
        method: input.paymentMethod,
        status: paid ? 'paid' : 'pending',
        amount: total,
        currency: 'DJF',
        reference: input.paymentReference,
        createdAt: now.toISOString(),
      },
      status: paid ? 'payment-confirmed' : 'created',
      timeline: [
        { status: 'created', date: now.toISOString() },
        ...(paid ? [{ status: 'payment-confirmed' as const, date: now.toISOString() }] : []),
      ],
      subtotal,
      discount,
      shippingCost,
      total,
      couponCode: input.coupon?.code,
      createdAt: now.toISOString(),
    };

    db.write((d) => {
      d.orders.unshift(order);
    });
    return order;
  },

  async getById(id: string): Promise<Order | null> {
    if (!USE_MOCK_API) return apiClient.get<Order | null>(`/orders/${id}`);
    await delay(250, 500);
    return db.read().orders.find((o) => o.id === id) ?? null;
  },

  async listForUser(userId: string, email: string): Promise<Order[]> {
    if (!USE_MOCK_API) return apiClient.get<Order[]>('/me/orders');
    await delay(300, 600);
    const mail = email.toLowerCase();
    return db
      .read()
      .orders.filter((o) => o.userId === userId || (!o.userId && o.customer.email.toLowerCase() === mail))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
};
