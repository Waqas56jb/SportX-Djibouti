import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool, query, queryOne } from '../../src/config/database.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { invalidateAuthContext } from '../../src/modules/auth/auth.context.js';
import { invalidateSettings } from '../../src/modules/settings/settings.service.js';

export const app = createApp();
export const api = () => request(app);

let seq = 0;
const uniq = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Removes all business data, keeping migration reference data (roles, permissions, settings, shipping). */
export async function resetData() {
  await pool.query(`truncate table
    public.payment_events, public.payment_status_history, public.refunds, public.payments, public.shipping,
    public.order_events, public.order_status_history, public.coupon_usages, public.order_items, public.orders,
    public.inventory_movements, public.inventory, public.cart_items, public.carts, public.wishlist_items, public.wishlists,
    public.reviews, public.product_images, public.product_variants, public.products, public.brands, public.categories,
    public.coupons, public.discounts, public.flash_sales, public.campaigns, public.notifications,
    public.support_messages, public.support_tickets, public.admin_activity_logs,
    public.auth_sessions, public.auth_tokens, public.auth_credentials, public.user_roles, public.addresses, public.users,
    public.newsletter_subscribers, public.contact_messages
    restart identity cascade`);
  await pool.query(`delete from public.counters`);
  // store_settings references users (updated_by), so the cascade above empties it — restore the defaults.
  await pool.query(`insert into public.store_settings (id, store_name, phone, address_line_1, address_line_2, city, free_shipping_threshold)
    values (1, 'SPORTX', '+253 21 25 26 19', 'PLACE MENELIK', 'RUE DE RAS MAKONNEN', 'DJIBOUTI', 25000)
    on conflict (id) do update set tax_rate = 0, tax_inclusive = false, free_shipping_threshold = 25000, max_quantity_per_line = 10`);
  invalidateAuthContext();
  invalidateSettings();
}

export const PASSWORD = 'Sportx2026!';

export async function registerCustomer(overrides: Partial<{ email: string; firstName: string }> = {}) {
  const email = overrides.email ?? `cust_${uniq()}@example.com`;
  const res = await api()
    .post('/api/v1/auth/register')
    .send({ firstName: overrides.firstName ?? 'Test', lastName: 'Customer', email, password: PASSWORD, phone: '+253 77 00 00 00' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.data.accessToken as string, user: res.body.data.user as { id: string; email: string }, email, cookies: res.headers['set-cookie'] as unknown as string[] };
}

/** Staff account created directly (admins are provisioned, not self-registered). */
export async function createStaff(roleSlug = 'SUPER_ADMIN') {
  const email = `staff_${uniq()}@example.com`;
  const u = await queryOne<{ id: string }>(`insert into public.users (first_name, last_name, email, email_verified_at) values ('Staff', $1, $2, now()) returning id`, [roleSlug, email]);
  await query(`insert into public.auth_credentials (user_id, password_hash) values ($1, $2)`, [u!.id, await hashPassword(PASSWORD)]);
  await query(`insert into public.user_roles (user_id, role_id) select $1, id from public.roles where slug = $2`, [u!.id, roleSlug]);
  const res = await api().post('/api/v1/admin/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`admin login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.data.accessToken as string, userId: u!.id, email };
}

export async function createCatalogBase() {
  const brand = await queryOne<{ id: string }>(`insert into public.brands (name, slug) values ($1, $2) returning id`, [`SPORTX ${uniq()}`, `sportx-${uniq()}`]);
  const parent = await queryOne<{ id: string }>(`insert into public.categories (name, slug) values ('Footwear', $1) returning id`, [`footwear-${uniq()}`]);
  const cat = await queryOne<{ id: string }>(`insert into public.categories (name, slug, parent_id) values ('Football Boots', $1, $2) returning id`, [`boots-${uniq()}`, parent!.id]);
  return { brandId: brand!.id, categoryId: cat!.id, parentCategoryId: parent!.id };
}

export interface ProductFixture {
  productId: string;
  variants: { id: string; sku: string; size: string }[];
}

export async function createProduct(opts: { price?: number; stock?: number; sizes?: string[]; status?: 'PUBLISHED' | 'DRAFT'; compareAt?: number | null } = {}): Promise<ProductFixture> {
  const base = await createCatalogBase();
  const n = uniq().toUpperCase();
  const p = await queryOne<{ id: string }>(
    `insert into public.products (name, slug, sku, brand_id, category_id, department, sport, gender, price, compare_at_price, status, published_at)
     values ($1, $2, $3, $4, $5, 'footwear', 'football', 'MEN', $6, $7, $8, now()) returning id`,
    [`Pro Elite Boot ${n}`, `pro-elite-boot-${n.toLowerCase()}`, `SX-T-${n}`, base.brandId, base.categoryId, opts.price ?? 20000, opts.compareAt ?? null, opts.status ?? 'PUBLISHED'],
  );
  const variants: ProductFixture['variants'] = [];
  for (const size of opts.sizes ?? ['41', '42']) {
    const sku = `SX-T-${n}-BLK-${size}`;
    const v = await queryOne<{ id: string }>(`insert into public.product_variants (product_id, sku, color, color_hex, size) values ($1, $2, 'Black', '#141414', $3) returning id`, [p!.id, sku, size]);
    await query(`insert into public.inventory (variant_id, stock_quantity, low_stock_threshold) values ($1, $2, 2)`, [v!.id, opts.stock ?? 10]);
    variants.push({ id: v!.id, sku, size });
  }
  return { productId: p!.id, variants };
}

/** Puts items straight into the server cart (used before the cart API exists in a test). */
export async function putInCart(userId: string, items: { variantId: string; quantity: number }[], couponCode?: string) {
  const cart = await queryOne<{ id: string }>(
    `insert into public.carts (user_id, coupon_code) values ($1, $2) on conflict (user_id) do update set coupon_code = excluded.coupon_code returning id`,
    [userId, couponCode ?? null],
  );
  for (const i of items) {
    await query(
      `insert into public.cart_items (cart_id, product_id, variant_id, quantity, unit_price_snapshot)
       select $1, v.product_id, v.id, $3, coalesce(v.price, p.price) from public.product_variants v join public.products p on p.id = v.product_id where v.id = $2
       on conflict (cart_id, variant_id) do update set quantity = excluded.quantity`,
      [cart!.id, i.variantId, i.quantity],
    );
  }
}

export async function stockOf(variantId: string) {
  return queryOne<{ stock_quantity: number; reserved_quantity: number }>(`select stock_quantity, reserved_quantity from public.inventory where variant_id = $1`, [variantId]);
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export const address = { firstName: 'Hodan', lastName: 'Ali', phone: '+253 77 12 34 56', addressLine1: 'Rue de Moscou, No. 12', city: 'Djibouti City', country: 'Djibouti' };
