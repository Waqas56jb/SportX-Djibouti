import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { address, api, auth, createProduct, createStaff, putInCart, registerCustomer, resetData } from '../helpers/fixtures.js';
import { query, queryOne } from '../../src/config/database.js';
import { requestId } from '../../src/middleware/requestId.middleware.js';
import { errorHandler } from '../../src/middleware/error.middleware.js';
import { productReviewsRouter } from '../../src/modules/reviews/reviews.routes.js';

/**
 * The catalog registry mounts productReviewsRouter at /products/:id/reviews; this mini app mounts it the
 * same way so these tests do not depend on the catalog module.
 */
const reviewsApp = express();
reviewsApp.use(requestId, express.json());
reviewsApp.use('/api/v1/products/:id/reviews', productReviewsRouter);
reviewsApp.use(errorHandler);
const reviewsApi = () => request(reviewsApp);

const review = { rating: 4, title: 'Great boots', comment: 'Comfortable from day one, true to size.', fit: 'true' };

async function deliveredOrder(customer: { token: string; user: { id: string } }, variantId: string) {
  const staff = await createStaff('SUPER_ADMIN');
  await putInCart(customer.user.id, [{ variantId, quantity: 1 }]);
  const order = await api().post('/api/v1/orders').set(auth(customer.token)).send({ shippingMethod: 'standard', paymentMethod: 'CASH_ON_DELIVERY', address });
  if (order.status !== 201) throw new Error(`order failed ${JSON.stringify(order.body)}`);
  for (const status of ['PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']) {
    const r = await api().patch(`/api/v1/admin/orders/${order.body.data.id}/status`).set(auth(staff.token)).send({ status });
    if (r.status !== 200) throw new Error(`transition ${status} failed ${JSON.stringify(r.body)}`);
  }
  return order.body.data.id as string;
}

describe('reviews', () => {
  beforeEach(resetData);

  it('requires a delivered order, stays pending until approved and updates the product rating', async () => {
    const p = await createProduct();
    const c = await registerCustomer({ firstName: 'Hodan' });

    const anon = await reviewsApi().post(`/api/v1/products/${p.productId}/reviews`).send(review);
    expect(anon.status).toBe(401);
    const early = await reviewsApi().post(`/api/v1/products/${p.productId}/reviews`).set(auth(c.token)).send(review);
    expect(early.status).toBe(403);
    expect(early.body.error.message).toBe('You can review products you have received.');

    const orderId = await deliveredOrder(c, p.variants[0].id);
    const created = await reviewsApi().post(`/api/v1/products/${p.productId}/reviews`).set(auth(c.token)).send({ ...review, body: undefined });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: 'PENDING', verifiedPurchase: true, author: 'Hodan C.', rating: 4 });
    const row = await queryOne<{ order_id: string }>(`select order_id from public.reviews where id = $1`, [created.body.data.id]);
    expect(row!.order_id).toBe(orderId);
    const staffNote = await queryOne<{ n: number }>(`select count(*)::int as n from public.notifications where type = 'REVIEW_PENDING'`);
    expect(staffNote!.n).toBe(1);

    const dup = await reviewsApi().post(`/api/v1/products/${p.productId}/reviews`).set(auth(c.token)).send(review);
    expect(dup.status).toBe(409);

    // Pending reviews are not public.
    const slug = (await queryOne<{ slug: string }>(`select slug from public.products where id = $1`, [p.productId]))!.slug;
    const before = await reviewsApi().get(`/api/v1/products/${slug}/reviews`);
    expect(before.status).toBe(200);
    expect(before.body.data.reviews).toEqual([]);
    expect(before.body.data.summary.total).toBe(0);

    const orderManager = await createStaff('ORDER_MANAGER');
    const denied = await api().patch(`/api/v1/admin/reviews/${created.body.data.id}/status`).set(auth(orderManager.token)).send({ status: 'APPROVED' });
    expect(denied.status).toBe(403);
    expect((await api().get('/api/v1/admin/reviews').set(auth(orderManager.token))).status).toBe(403);

    const support = await createStaff('SUPPORT_MANAGER'); // has reviews:approve
    const approved = await api().patch(`/api/v1/admin/reviews/${created.body.data.id}/status`).set(auth(support.token)).send({ status: 'approved' });
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({ status: 'APPROVED', moderatedBy: 'Staff SUPPORT_MANAGER' });
    expect((await api().delete(`/api/v1/admin/reviews/${created.body.data.id}`).set(auth(support.token))).status).toBe(403); // no reviews:delete

    const product = await queryOne<{ rating: number; review_count: number }>(`select rating, review_count from public.products where id = $1`, [p.productId]);
    expect(product).toEqual({ rating: 4, review_count: 1 });

    const after = await reviewsApi().get(`/api/v1/products/${p.productId}/reviews?sort=highest`);
    expect(after.body.data.reviews).toHaveLength(1);
    expect(after.body.data.reviews[0]).toMatchObject({ author: 'Hodan C.', rating: 4, comment: review.comment, fit: 'true', verifiedPurchase: true });
    expect(after.body.data.reviews[0]).not.toHaveProperty('userId');
    expect(after.body.data.summary).toEqual({ average: 4, total: 1, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 } });
    expect(after.body.data.pagination.total).toBe(1);

    // Editing returns the review to moderation and the rating follows.
    const edited = await api().patch(`/api/v1/reviews/${created.body.data.id}`).set(auth(c.token)).send({ rating: 2 });
    expect(edited.body.data.status).toBe('PENDING');
    expect(await queryOne(`select rating, review_count from public.products where id = $1`, [p.productId])).toEqual({ rating: 0, review_count: 0 });

    const mine = await api().get('/api/v1/reviews/mine').set(auth(c.token));
    expect(mine.body.data[0]).toMatchObject({ id: created.body.data.id, rating: 2, status: 'PENDING', product: { id: p.productId } });

    const other = await registerCustomer();
    expect((await api().patch(`/api/v1/reviews/${created.body.data.id}`).set(auth(other.token)).send({ rating: 1 })).status).toBe(404);
    expect((await api().delete(`/api/v1/reviews/${created.body.data.id}`).set(auth(other.token))).status).toBe(404);
    expect((await api().delete(`/api/v1/reviews/${created.body.data.id}`).set(auth(c.token))).status).toBe(200);
    expect((await api().get('/api/v1/reviews/mine').set(auth(c.token))).body.data).toEqual([]);
  });

  it('admin list filters, counts per status, bulk moderation and soft delete', async () => {
    const p = await createProduct();
    const a = await registerCustomer({ firstName: 'Amina' });
    const b = await registerCustomer({ firstName: 'Bilan' });
    await deliveredOrder(a, p.variants[0].id);
    await deliveredOrder(b, p.variants[0].id);
    const ra = await reviewsApi().post(`/api/v1/products/${p.productId}/reviews`).set(auth(a.token)).send({ ...review, rating: 5 });
    const rb = await reviewsApi().post(`/api/v1/products/${p.productId}/reviews`).set(auth(b.token)).send({ ...review, rating: 3 });

    const admin = await createStaff('ADMIN');
    const bulk = await api().patch('/api/v1/admin/reviews/bulk').set(auth(admin.token)).send({ ids: [ra.body.data.id, rb.body.data.id], status: 'APPROVED' });
    expect(bulk.body.data.updated).toBe(2);
    expect(await queryOne(`select rating, review_count from public.products where id = $1`, [p.productId])).toEqual({ rating: 4, review_count: 2 });

    await api().patch(`/api/v1/admin/reviews/${rb.body.data.id}/status`).set(auth(admin.token)).send({ status: 'HIDDEN' });
    const list = await api().get('/api/v1/admin/reviews?status=APPROVED').set(auth(admin.token));
    expect(list.status).toBe(200);
    expect(list.body.data.map((r: { id: string }) => r.id)).toEqual([ra.body.data.id]);
    expect(list.body.counts).toMatchObject({ ALL: 2, APPROVED: 1, HIDDEN: 1, PENDING: 0 });
    expect(list.body.data[0]).toMatchObject({ customerName: 'Amina Customer', productId: p.productId, rating: 5 });
    const search = await api().get('/api/v1/admin/reviews?search=bilan').set(auth(admin.token));
    expect(search.body.data.map((r: { id: string }) => r.id)).toEqual([rb.body.data.id]);
    expect((await api().get('/api/v1/admin/reviews?rating=5').set(auth(admin.token))).body.data).toHaveLength(1);

    expect((await api().delete(`/api/v1/admin/reviews/${ra.body.data.id}`).set(auth(admin.token))).status).toBe(200);
    expect(await queryOne(`select rating, review_count from public.products where id = $1`, [p.productId])).toEqual({ rating: 0, review_count: 0 });
    const logs = await query<{ action: string }>(`select action from public.admin_activity_logs where entity_type = 'review' order by created_at`);
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(['Reviews bulk approved', 'Review hidden', 'Review deleted']));
  });
});

describe('support tickets', () => {
  beforeEach(resetData);

  it('customer creates and replies; internal notes never reach the customer', async () => {
    const p = await createProduct();
    const c = await registerCustomer();
    const other = await registerCustomer();
    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 1 }]);
    const order = await api().post('/api/v1/orders').set(auth(c.token)).send({ shippingMethod: 'standard', paymentMethod: 'CASH_ON_DELIVERY', address });

    const foreign = await api().post('/api/v1/support/tickets').set(auth(other.token)).send({ subject: 'Where is it?', category: 'delivery', orderNumber: order.body.data.orderNumber, message: 'Hello' });
    expect(foreign.status).toBe(400);

    const t = await api().post('/api/v1/support/tickets').set(auth(c.token)).send({ subject: 'Where is my order?', category: 'delivery', orderNumber: order.body.data.orderNumber.toLowerCase(), message: 'It has been two days.' });
    expect(t.status).toBe(201);
    expect(t.body.data).toMatchObject({ status: 'OPEN', category: 'DELIVERY', orderNumber: order.body.data.orderNumber, priority: 'NORMAL' });
    expect(t.body.data.number).toMatch(/^TKT-\d{6}$/);
    expect(t.body.data.messages).toHaveLength(1);
    const id = t.body.data.id;
    expect((await queryOne<{ n: number }>(`select count(*)::int as n from public.notifications where type = 'NEW_TICKET'`))!.n).toBe(1);

    // Other customers cannot see or reply (404).
    expect((await api().get(`/api/v1/support/tickets/${id}`).set(auth(other.token))).status).toBe(404);
    expect((await api().post(`/api/v1/support/tickets/${id}/messages`).set(auth(other.token)).send({ body: 'hi' })).status).toBe(404);
    expect((await api().get('/api/v1/support/tickets').set(auth(other.token))).body.data).toEqual([]);

    const agent = await createStaff('SUPPORT_MANAGER');
    const note = await api().post(`/api/v1/admin/support/tickets/${id}/messages`).set(auth(agent.token)).send({ body: 'SECRET: courier delayed, check with warehouse', internal: true });
    expect(note.status).toBe(200);
    expect(note.body.data.status).toBe('OPEN');
    expect(note.body.data.assignedToId).toBe(agent.userId); // auto-assigned
    expect((await queryOne<{ n: number }>(`select count(*)::int as n from public.notifications where type = 'SUPPORT_REPLY'`))!.n).toBe(0);

    const reply = await api().post(`/api/v1/admin/support/tickets/${id}/messages`).set(auth(agent.token)).send({ body: 'Your order ships tomorrow.' });
    expect(reply.body.data.status).toBe('WAITING_CUSTOMER');
    expect(reply.body.data.messages.map((m: { internal: boolean }) => m.internal)).toEqual([false, true, false]);
    expect((await queryOne<{ n: number }>(`select count(*)::int as n from public.notifications where type = 'SUPPORT_REPLY' and user_id = $1`, [c.user.id]))!.n).toBe(1);

    const view = await api().get(`/api/v1/support/tickets/${id}`).set(auth(c.token));
    expect(view.status).toBe(200);
    expect(JSON.stringify(view.body)).not.toContain('SECRET');
    expect(view.body.data.messages.map((m: { author: string }) => m.author)).toEqual(['customer', 'support']);
    expect(view.body.data).not.toHaveProperty('assignedToId');
    const list = await api().get('/api/v1/support/tickets').set(auth(c.token));
    expect(list.body.data[0]).toMatchObject({ id, messageCount: 2 });
    expect(JSON.stringify(list.body)).not.toContain('SECRET');

    // Customer reply re-opens a waiting ticket.
    const back = await api().post(`/api/v1/support/tickets/${id}/messages`).set(auth(c.token)).send({ body: 'Thanks!' });
    expect(back.body.data.status).toBe('OPEN');

    // Resolved → reopened; closed → read-only.
    await api().patch(`/api/v1/admin/support/tickets/${id}/status`).set(auth(agent.token)).send({ status: 'resolved' });
    expect((await api().post(`/api/v1/support/tickets/${id}/messages`).set(auth(c.token)).send({ body: 'One more thing' })).body.data.status).toBe('OPEN');
    await api().patch(`/api/v1/admin/support/tickets/${id}/status`).set(auth(agent.token)).send({ status: 'CLOSED' });
    const closed = await api().post(`/api/v1/support/tickets/${id}/messages`).set(auth(c.token)).send({ body: 'Hello?' });
    expect(closed.status).toBe(409);
  });

  it('admin desk: filters, counts, assignment rules, detail and permissions', async () => {
    const c = await registerCustomer();
    const t1 = await api().post('/api/v1/support/tickets').set(auth(c.token)).send({ subject: 'Refund question', category: 'return', message: 'How do returns work?' });
    const t2 = await api().post('/api/v1/support/tickets').set(auth(c.token)).send({ subject: 'Payment failed', category: 'PAYMENT', message: 'My card was declined.' });
    const agent = await createStaff('SUPPORT_MANAGER');
    const productManager = await createStaff('PRODUCT_MANAGER'); // no support permissions
    const customerTwo = await registerCustomer();

    expect((await api().get('/api/v1/admin/support/tickets').set(auth(productManager.token))).status).toBe(403);
    expect((await api().get('/api/v1/admin/support/tickets').set(auth(c.token))).status).toBe(403);

    const assignees = await api().get('/api/v1/admin/support/assignees').set(auth(agent.token));
    expect(assignees.body.data.map((a: { id: string }) => a.id)).toContain(agent.userId);
    expect(assignees.body.data.map((a: { id: string }) => a.id)).not.toContain(productManager.userId);

    const bad = await api().patch(`/api/v1/admin/support/tickets/${t1.body.data.id}`).set(auth(agent.token)).send({ assignedToId: productManager.userId });
    expect(bad.status).toBe(400);
    expect((await api().patch(`/api/v1/admin/support/tickets/${t1.body.data.id}`).set(auth(agent.token)).send({ assignedToId: customerTwo.user.id })).status).toBe(400);
    const assigned = await api().patch(`/api/v1/admin/support/tickets/${t1.body.data.id}`).set(auth(agent.token)).send({ assignedToId: agent.userId, priority: 'high', status: 'in-progress' });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data).toMatchObject({ assignedToId: agent.userId, priority: 'HIGH', status: 'IN_PROGRESS', category: 'RETURNS' });
    expect(assigned.body.data.customer).toMatchObject({ id: c.user.id, ordersCount: 0 });
    expect(assigned.body.data.recentOrders).toEqual([]);

    const unassigned = await api().get('/api/v1/admin/support/tickets?assignedToId=unassigned').set(auth(agent.token));
    expect(unassigned.body.data.map((t: { id: string }) => t.id)).toEqual([t2.body.data.id]);
    const inProgress = await api().get('/api/v1/admin/support/tickets?status=in_progress').set(auth(agent.token));
    expect(inProgress.body.data.map((t: { id: string }) => t.id)).toEqual([t1.body.data.id]);
    expect(inProgress.body.counts).toMatchObject({ ALL: 2, OPEN: 1, IN_PROGRESS: 1 });
    const search = await api().get('/api/v1/admin/support/tickets?search=declined').set(auth(agent.token));
    expect(search.body.data).toHaveLength(0); // search covers number/subject/customer/order, not message bodies
    const bySubject = await api().get(`/api/v1/admin/support/tickets?search=${t2.body.data.number}`).set(auth(agent.token));
    expect(bySubject.body.data.map((t: { id: string }) => t.id)).toEqual([t2.body.data.id]);

    const logs = await query<{ action: string }>(`select action from public.admin_activity_logs where entity_type = 'support_ticket'`);
    expect(logs.map((l) => l.action)).toContain('Ticket updated');
  });
});

describe('avatar', () => {
  beforeEach(resetData);

  it('uploads a verified image and removes it', async () => {
    const c = await registerCustomer();
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
    const up = await api().post('/api/v1/users/me/avatar').set(auth(c.token)).attach('file', png, { filename: 'me.png', contentType: 'image/png' });
    expect(up.status).toBe(200);
    expect(up.body.data.user.avatarUrl).toMatch(new RegExp(`/uploads/users/${c.user.id}/.+\\.png$`));
    const fake = await api().post('/api/v1/users/me/avatar').set(auth(c.token)).attach('file', Buffer.from('not an image at all'), { filename: 'x.png', contentType: 'image/png' });
    expect(fake.status).toBe(415);
    const del = await api().delete('/api/v1/users/me/avatar').set(auth(c.token));
    expect(del.body.data.user.avatarUrl).toBeNull();
  });
});
