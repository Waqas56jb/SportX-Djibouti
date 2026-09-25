import { beforeEach, describe, expect, it } from 'vitest';
import { address, api, auth, createStaff, putInCart, registerCustomer, resetData } from '../helpers/fixtures.js';
import { query, queryOne } from '../../src/config/database.js';

// ───────────────────────── Local fixtures ─────────────────────────

const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function category(name: string, slug: string, parentId: string | null = null) {
  return (await queryOne<{ id: string }>(`insert into public.categories (name, slug, parent_id) values ($1, $2, $3) returning id`, [name, slug, parentId]))!.id;
}
async function brand(name: string, slug: string) {
  return (await queryOne<{ id: string }>(`insert into public.brands (name, slug) values ($1, $2) returning id`, [name, slug]))!.id;
}

interface SeedOpts {
  name: string;
  sku: string;
  brandId: string;
  categoryId: string;
  department?: string;
  sport?: string;
  gender?: string;
  price: number;
  compareAt?: number | null;
  status?: string;
  isNew?: boolean;
  popularity?: number;
  variants: { color: string; hex?: string; size: string; stock: number }[];
  image?: boolean;
}

async function seedProduct(o: SeedOpts) {
  const slug = o.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const p = await queryOne<{ id: string }>(
    `insert into public.products (name, slug, sku, brand_id, category_id, department, sport, gender, price, compare_at_price, status, is_new, popularity, published_at, description)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), 'Built for the game.') returning id`,
    [o.name, slug, o.sku, o.brandId, o.categoryId, o.department ?? 'footwear', o.sport ?? 'football', o.gender ?? 'MEN', o.price, o.compareAt ?? null, o.status ?? 'PUBLISHED', o.isNew ?? false, o.popularity ?? 0],
  );
  const variants: { id: string; sku: string }[] = [];
  for (const [i, v] of o.variants.entries()) {
    const sku = `${o.sku}-${v.color.toUpperCase().slice(0, 3)}-${v.size}`;
    const row = await queryOne<{ id: string }>(
      `insert into public.product_variants (product_id, sku, color, color_hex, size, position) values ($1, $2, $3, $4, $5, $6) returning id`,
      [p!.id, sku, v.color, v.hex ?? '#141414', v.size, i],
    );
    await query(`insert into public.inventory (variant_id, stock_quantity, low_stock_threshold) values ($1, $2, 2)`, [row!.id, v.stock]);
    variants.push({ id: row!.id, sku });
  }
  if (o.image !== false) {
    await query(`insert into public.product_images (product_id, url, alt, role, position) values ($1, 'https://img.example.com/main.jpg', 'main', 'MAIN', 0)`, [p!.id]);
    await query(`insert into public.product_images (product_id, url, alt, role, color, position) values ($1, 'https://img.example.com/red.jpg', 'red', 'GALLERY', 'Red', 1)`, [p!.id]);
  }
  return { id: p!.id, slug, variants };
}

async function seedCatalog() {
  const footwear = await category('Footwear', 'footwear');
  const boots = await category('Football Boots', 'football-boots', footwear);
  const apparel = await category('Apparel', 'apparel');
  const tees = await category('Tees', 'tees', apparel);
  const elite = await brand('SPORTX ELITE', 'sportx-elite');
  const basic = await brand('SPORTX', 'sportx');
  const boot = await seedProduct({
    name: 'Pro Elite Boot', sku: 'SX-FB-001', brandId: elite, categoryId: boots, price: 20000, popularity: 90,
    variants: [{ color: 'Red', hex: '#FF0000', size: '41', stock: 5 }, { color: 'Black', size: '42', stock: 0 }],
  });
  const unisexBoot = await seedProduct({
    name: 'Street Boot', sku: 'SX-FB-002', brandId: basic, categoryId: boots, gender: 'UNISEX', price: 15000, compareAt: 18000, popularity: 50,
    variants: [{ color: 'White', hex: '#FFFFFF', size: '42', stock: 3 }],
  });
  const tee = await seedProduct({
    name: 'Run Tee', sku: 'SX-AP-001', brandId: basic, categoryId: tees, department: 'apparel', sport: 'running', gender: 'WOMEN', price: 5000, isNew: true, popularity: 10,
    variants: [{ color: 'Blue', hex: '#0000FF', size: 'M', stock: 8 }],
  });
  const draft = await seedProduct({
    name: 'Secret Draft Tee', sku: 'SX-AP-999', brandId: basic, categoryId: tees, department: 'apparel', sport: 'training', gender: 'KIDS', price: 3000, status: 'DRAFT',
    variants: [{ color: 'Grey', size: 'S', stock: 4 }],
  });
  return { footwear, boots, apparel, tees, elite, basic, boot, unisexBoot, tee, draft };
}

const names = (res: { body: { data: { name: string }[] } }) => res.body.data.map((p) => p.name);

// ───────────────────────── Storefront ─────────────────────────

describe('public catalogue listing', () => {
  beforeEach(resetData);

  it('filters by category (incl. children), size, colour, price, sale and collection; hides drafts', async () => {
    await seedCatalog();
    const all = await api().get('/api/v1/products');
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(3);
    expect(names(all)).not.toContain('Secret Draft Tee');

    expect(names(await api().get('/api/v1/products?category=footwear')).sort()).toEqual(['Pro Elite Boot', 'Street Boot']);
    expect(names(await api().get('/api/v1/products?categories=tees&categories=football-boots'))).toHaveLength(3);
    // Size matches in-stock variants only: the boot's 42 is out of stock.
    expect(names(await api().get('/api/v1/products?size=42'))).toEqual(['Street Boot']);
    expect(names(await api().get('/api/v1/products?size=41'))).toEqual(['Pro Elite Boot']);
    expect(names(await api().get('/api/v1/products?color=RED'))).toEqual(['Pro Elite Boot']);
    expect(names(await api().get('/api/v1/products?minPrice=10000&maxPrice=16000'))).toEqual(['Street Boot']);
    expect(names(await api().get('/api/v1/products?sale=true'))).toEqual(['Street Boot']);
    expect(names(await api().get('/api/v1/products?collection=sale'))).toEqual(['Street Boot']);
    expect(names(await api().get('/api/v1/products?collection=men')).sort()).toEqual(['Pro Elite Boot', 'Street Boot']);
    expect(names(await api().get('/api/v1/products?collection=women')).sort()).toEqual(['Run Tee', 'Street Boot']);
    expect(names(await api().get('/api/v1/products?collection=new-arrivals'))).toEqual(['Run Tee']);
    expect(names(await api().get('/api/v1/products?collection=running'))).toEqual(['Run Tee']);
    expect(names(await api().get('/api/v1/products?collection=apparel'))).toEqual(['Run Tee']);
    expect(names(await api().get('/api/v1/products?brand=sportx-elite'))).toEqual(['Pro Elite Boot']);
    expect(names(await api().get('/api/v1/products?brands=SPORTX'))).toHaveLength(2);
    expect(names(await api().get('/api/v1/products?inStock=true'))).toHaveLength(3);
  });

  it('sorts, paginates and computes facets on the base set', async () => {
    await seedCatalog();
    expect(names(await api().get('/api/v1/products?sort=price_asc'))).toEqual(['Run Tee', 'Street Boot', 'Pro Elite Boot']);
    expect(names(await api().get('/api/v1/products?sort=price-desc'))).toEqual(['Pro Elite Boot', 'Street Boot', 'Run Tee']);
    expect(names(await api().get('/api/v1/products?sort=popular'))[0]).toBe('Pro Elite Boot');

    const page2 = await api().get('/api/v1/products?sort=price_asc&limit=2&page=2');
    expect(names(page2)).toEqual(['Pro Elite Boot']);
    expect(page2.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2, hasNext: false, hasPrevious: true });
    expect((await api().get('/api/v1/products?limit=49')).status).toBe(400);

    // Facets ignore the refinement (size) but respect the collection.
    const res = await api().get('/api/v1/products?collection=men&size=41');
    expect(res.body.data).toHaveLength(1);
    const f = res.body.facets;
    expect(f.categories).toEqual([{ value: 'football-boots', label: 'Football Boots', count: 2 }]);
    expect(f.sizes.map((s: { value: string }) => s.value)).toEqual(['41', '42']);
    expect(f.colors).toEqual(expect.arrayContaining([expect.objectContaining({ value: 'Red', hex: '#FF0000', count: 1 })]));
    expect(f.genders).toEqual(expect.arrayContaining([{ value: 'men', label: 'Men', count: 1 }, { value: 'unisex', label: 'Unisex', count: 1 }]));
    expect(f.priceRange).toEqual({ min: 15000, max: 20000 });

    const summary = res.body.data[0];
    expect(summary).toMatchObject({
      slug: 'pro-elite-boot', brand: { name: 'SPORTX ELITE', slug: 'sportx-elite' }, category: { slug: 'football-boots' },
      price: 20000, isSale: false, image: 'https://img.example.com/main.jpg', hoverImage: 'https://img.example.com/red.jpg',
      sizes: ['41', '42'], available: 5, stockStatus: 'IN_STOCK',
    });
    expect(summary.colors).toEqual([{ name: 'Red', hex: '#FF0000' }, { name: 'Black', hex: '#141414' }]);
  });

  it('searches by variant SKU, brand name and words; supports featured and batch', async () => {
    const c = await seedCatalog();
    expect(names(await api().get('/api/v1/products/search?q=SX-FB-002-WHI-42'))).toEqual(['Street Boot']);
    expect(names(await api().get('/api/v1/products/search?q=elite'))).toEqual(['Pro Elite Boot']);
    expect(names(await api().get('/api/v1/products/search?q=boots')).sort()).toEqual(['Pro Elite Boot', 'Street Boot']);
    expect(names(await api().get('/api/v1/products/search?q=secret'))).toEqual([]);
    expect(names(await api().get('/api/v1/products?q=running'))).toEqual(['Run Tee']);
    expect((await api().get('/api/v1/products/search')).status).toBe(400);

    expect(names(await api().get('/api/v1/products/featured?kind=new'))).toEqual(['Run Tee']);
    expect(names(await api().get('/api/v1/products/featured?kind=sale'))).toEqual(['Street Boot']);

    const batch = await api().get(`/api/v1/products/batch?ids=${c.tee.id},${c.draft.id},not-a-uuid,${c.boot.id}`);
    expect(names(batch)).toEqual(['Run Tee', 'Pro Elite Boot']);
    expect(names(await api().get('/api/v1/products/batch?slugs=street-boot'))).toEqual(['Street Boot']);
  });

  it('serves categories as a tree with counts, and active brands', async () => {
    await seedCatalog();
    const res = await api().get('/api/v1/categories');
    const footwear = res.body.data.find((c: { slug: string }) => c.slug === 'footwear');
    expect(footwear.productCount).toBe(2);
    expect(footwear.children[0]).toMatchObject({ slug: 'football-boots', productCount: 2 });
    const apparel = res.body.data.find((c: { slug: string }) => c.slug === 'apparel');
    expect(apparel.productCount).toBe(1); // the draft tee is not counted

    const one = await api().get('/api/v1/categories/football-boots');
    expect(one.body.data.breadcrumb.map((b: { slug: string }) => b.slug)).toEqual(['footwear', 'football-boots']);
    expect((await api().get('/api/v1/categories/nope')).status).toBe(404);

    const brands = await api().get('/api/v1/brands');
    expect(brands.body.data.map((b: { slug: string; productCount: number }) => [b.slug, b.productCount])).toEqual([['sportx', 2], ['sportx-elite', 1]]);
    expect((await api().get('/api/v1/brands/sportx-elite')).body.data.productCount).toBe(1);
  });
});

describe('product detail page', () => {
  beforeEach(resetData);

  it('returns variants with availability and the sale price from an active discount; drafts are 404', async () => {
    const c = await seedCatalog();
    await query(`insert into public.discounts (name, type, value, applies_to, target_ids) values ('Boot week', 'PERCENTAGE', 20, 'PRODUCTS', $1)`, [[c.boot.id]]);
    await query(`update public.products set complete_the_look = $2 where id = $1`, [c.boot.id, [c.tee.id, c.draft.id]]);

    const res = await api().get('/api/v1/products/pro-elite-boot');
    expect(res.status).toBe(200);
    const p = res.body.data;
    expect(p).toMatchObject({
      id: c.boot.id, price: 16000, originalPrice: 20000, compareAtPrice: 20000, salePrice: 16000, isSale: true, discountPercent: 20,
      brand: { id: c.elite, name: 'SPORTX ELITE', slug: 'sportx-elite' },
      category: { slug: 'football-boots', parent: { slug: 'footwear' } },
      sizes: ['41', '42'], stock: 5, stockStatus: 'IN_STOCK',
    });
    expect(p.pricing).toMatchObject({ price: 16000, isSale: true, discountPercent: 20, currency: 'DJF' });
    expect(p.variants).toEqual([
      expect.objectContaining({ sku: 'SX-FB-001-RED-41', color: 'Red', size: '41', price: 16000, compareAtPrice: 20000, available: 5, stockStatus: 'IN_STOCK' }),
      expect.objectContaining({ sku: 'SX-FB-001-BLA-42', available: 0, stockStatus: 'OUT_OF_STOCK' }),
    ]);
    expect(p.colors).toEqual([{ name: 'Red', hex: '#FF0000', imageIndex: 1 }, { name: 'Black', hex: '#141414' }]);
    expect(p.images[0]).toMatchObject({ role: 'MAIN', url: 'https://img.example.com/main.jpg' });
    expect(p.ratingDistribution).toEqual({ '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 });
    expect(p.shipping.freeShippingThreshold).toBe(25000);
    expect(p.shipping.methods.map((m: { code: string }) => m.code)).toEqual(['standard', 'express', 'pickup']);
    expect(p.related.map((r: { name: string }) => r.name)).toEqual(['Street Boot']);
    expect(p.completeTheLook.map((r: { name: string }) => r.name)).toEqual(['Run Tee']); // curated; the draft is skipped
    const ctl = await api().get('/api/v1/products/pro-elite-boot/complete-the-look?limit=2');
    expect(ctl.body.data.map((r: { name: string }) => r.name)).toEqual(['Run Tee']);
    // Reviews router (reviews module) is mounted under the product.
    expect((await api().get('/api/v1/products/pro-elite-boot/reviews')).status).not.toBe(404);

    // The listing uses the same effective price and treats the discounted product as on sale.
    expect(names(await api().get('/api/v1/products?collection=sale')).sort()).toEqual(['Pro Elite Boot', 'Street Boot']);
    expect(names(await api().get('/api/v1/products?maxPrice=16000')).sort()).toEqual(['Pro Elite Boot', 'Run Tee', 'Street Boot']);

    // By id too; view counter increments without blocking.
    expect((await api().get(`/api/v1/products/${c.boot.id}`)).status).toBe(200);
    const views = await queryOne<{ view_count: number }>(`select view_count from public.products where id = $1`, [c.boot.id]);
    expect(views!.view_count).toBeGreaterThanOrEqual(1);

    expect((await api().get('/api/v1/products/secret-draft-tee')).status).toBe(404);
    expect((await api().get(`/api/v1/products/${c.draft.id}`)).status).toBe(404);
    expect((await api().get('/api/v1/products/secret-draft-tee/related')).status).toBe(404);
  });
});

// ───────────────────────── Admin ─────────────────────────

describe('admin products', () => {
  beforeEach(resetData);

  async function base() {
    const cat = await category('Football Boots', 'football-boots', await category('Footwear', 'footwear'));
    const b = await brand('SPORTX', 'sportx');
    return { categoryId: cat, brandId: b };
  }
  const body = (refs: { categoryId: string; brandId: string }, extra: Record<string, unknown> = {}) => ({
    name: 'Admin Boot',
    sku: 'sx-adm-001',
    brandId: refs.brandId,
    categoryId: refs.categoryId,
    sport: 'football',
    gender: 'men',
    price: 25000,
    variants: [
      { color: 'Black', colorHex: '#141414', size: '41', stock: 7, lowStockThreshold: 3 },
      { color: 'Black', size: '42', stock: 0 },
    ],
    ...extra,
  });

  it('creates a product with variants and stock in one transaction (inventory rows + movements)', async () => {
    const refs = await base();
    const staff = await createStaff('PRODUCT_MANAGER');
    const res = await api().post('/api/v1/admin/products').set(auth(staff.token)).send(body(refs));
    expect(res.status).toBe(201);
    const p = res.body.data;
    expect(p).toMatchObject({ sku: 'SX-ADM-001', slug: 'admin-boot', status: 'DRAFT', department: 'footwear', gender: 'MEN', totalStock: 7, variantsCount: 2 });
    expect(p.variants[0]).toMatchObject({ sku: 'SX-ADM-001-BLACK-41', stock: 7, reserved: 0, lowStockThreshold: 3, isActive: true });
    const inv = await query<{ stock_quantity: number }>(`select i.stock_quantity from public.inventory i join public.product_variants v on v.id = i.variant_id where v.product_id = $1 order by v.position`, [p.id]);
    expect(inv.map((r) => r.stock_quantity)).toEqual([7, 0]);
    const moves = await query<{ reason: string; change: number; admin_id: string }>(`select reason, change, admin_id from public.inventory_movements where product_id = $1`, [p.id]);
    expect(moves).toEqual([{ reason: 'RESTOCK', change: 7, admin_id: staff.userId }]);
    const log = await queryOne<{ action: string }>(`select action from public.admin_activity_logs where entity_id = $1`, [p.id]);
    expect(log!.action).toBe('Product created');

    // Same name → unique slug; list row shape.
    const again = await api().post('/api/v1/admin/products').set(auth(staff.token)).send(body(refs, { sku: 'SX-ADM-002', variants: [] }));
    expect(again.body.data.slug).toBe('admin-boot-2');
    const list = await api().get('/api/v1/admin/products?search=SX-ADM-001-BLACK&sort=name').set(auth(staff.token));
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ brandName: 'SPORTX', categoryName: 'Football Boots', totalStock: 7, stockStatus: 'IN_STOCK', variantsCount: 2, unitsSold: 0 });
    const outOfStock = await api().get('/api/v1/admin/products?stock=out_of_stock').set(auth(staff.token));
    expect(outOfStock.body.data.map((x: { sku: string }) => x.sku)).toEqual(['SX-ADM-002']);

    // Stock edits through PATCH are logged as movements.
    const upd = await api().patch(`/api/v1/admin/products/${p.id}`).set(auth(staff.token)).send({
      price: 24000,
      variants: [{ id: p.variants[0].id, color: 'Black', size: '41', stock: 4 }, { color: 'Red', size: '43', stock: 2 }],
    });
    expect(upd.status).toBe(200);
    expect(upd.body.data.price).toBe(24000);
    expect(upd.body.data.variants.map((v: { size: string; stock: number }) => [v.size, v.stock])).toEqual([['41', 4], ['43', 2]]);
    const reasons = await query<{ reason: string; change: number }>(`select reason, change from public.inventory_movements where product_id = $1 order by created_at`, [p.id]);
    expect(reasons.map((r) => [r.reason, r.change])).toEqual(expect.arrayContaining([['MANUAL_ADJUSTMENT', -3], ['RESTOCK', 2]]));
    const removed = await queryOne<{ deleted_at: Date | null }>(`select deleted_at from public.product_variants where id = $1`, [p.variants[1].id]);
    expect(removed!.deleted_at).not.toBeNull();

    const valid = await api().get('/api/v1/admin/products/validate?field=sku&value=sx-adm-001-black-41').set(auth(staff.token));
    expect(valid.body.data.unique).toBe(false);
    const free = await api().get('/api/v1/admin/products/validate?field=slug&value=Brand New Boot').set(auth(staff.token));
    expect(free.body.data).toMatchObject({ unique: true, value: 'brand-new-boot' });
  });

  it('rejects duplicate SKUs with CONFLICT naming the field', async () => {
    const refs = await base();
    const staff = await createStaff('PRODUCT_MANAGER');
    expect((await api().post('/api/v1/admin/products').set(auth(staff.token)).send(body(refs))).status).toBe(201);
    const dupProduct = await api().post('/api/v1/admin/products').set(auth(staff.token)).send(body(refs, { variants: [] }));
    expect(dupProduct.status).toBe(409);
    expect(dupProduct.body.error).toMatchObject({ code: 'CONFLICT', details: { field: 'sku' } });
    const dupVariant = await api().post('/api/v1/admin/products').set(auth(staff.token))
      .send(body(refs, { sku: 'SX-ADM-009', variants: [{ sku: 'SX-ADM-001-BLACK-41', color: 'Red', size: '40' }] }));
    expect(dupVariant.status).toBe(409);
    expect(dupVariant.body.error.details.field).toBe('variants.0.sku');
    // Nothing partial was written.
    expect((await queryOne<{ n: number }>(`select count(*)::int as n from public.products`))!.n).toBe(1);
  });

  it('publishing requires an active variant and a MAIN image; image upload validates real bytes', async () => {
    const refs = await base();
    const staff = await createStaff('PRODUCT_MANAGER');
    const p = (await api().post('/api/v1/admin/products').set(auth(staff.token)).send(body(refs))).body.data;

    const noImage = await api().patch(`/api/v1/admin/products/${p.id}/status`).set(auth(staff.token)).send({ status: 'published' });
    expect(noImage.status).toBe(400);
    expect(noImage.body.error.code).toBe('VALIDATION_ERROR');
    expect(noImage.body.error.message).toMatch(/main image/);

    const fake = await api().post(`/api/v1/admin/products/${p.id}/images`).set(auth(staff.token))
      .attach('file', Buffer.from('this is definitely not an image'), { filename: 'evil.png', contentType: 'image/png' });
    expect(fake.status).toBe(415);
    expect(fake.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');

    const up = await api().post(`/api/v1/admin/products/${p.id}/images`).set(auth(staff.token))
      .field('alt', 'Side view').attach('file', PNG_1x1, { filename: 'boot.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    expect(up.body.data).toMatchObject({ role: 'MAIN', alt: 'Side view' });
    expect(up.body.data.storageKey).toMatch(new RegExp(`^products/${p.id}/`));

    const pub = await api().patch(`/api/v1/admin/products/${p.id}/status`).set(auth(staff.token)).send({ status: 'PUBLISHED' });
    expect(pub.status).toBe(200);
    expect(pub.body.data.status).toBe('PUBLISHED');
    expect(pub.body.data.publishedAt).not.toBeNull();
    expect((await api().get('/api/v1/products/admin-boot')).status).toBe(200);

    // A second upload is a gallery image; reorder + delete (MAIN is promoted).
    const second = await api().post(`/api/v1/admin/products/${p.id}/images`).set(auth(staff.token)).attach('file', PNG_1x1, { filename: 'b.png', contentType: 'image/png' });
    expect(second.body.data.role).toBe('GALLERY');
    const order = await api().put(`/api/v1/admin/products/${p.id}/images/order`).set(auth(staff.token)).send({ ids: [second.body.data.id, up.body.data.id] });
    expect(order.body.data.map((i: { id: string }) => i.id)).toEqual([second.body.data.id, up.body.data.id]);
    expect((await api().delete(`/api/v1/admin/products/${p.id}/images/${up.body.data.id}`).set(auth(staff.token))).status).toBe(200);
    const after = await api().get(`/api/v1/admin/products/${p.id}`).set(auth(staff.token));
    expect(after.body.data.images).toEqual([expect.objectContaining({ id: second.body.data.id, role: 'MAIN' })]);

    const logs = await query<{ action: string }>(`select action from public.admin_activity_logs where entity_id = $1 order by created_at`, [p.id]);
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(['Product created', 'Image uploaded', 'Product published', 'Image deleted']));
  });

  it('archives (not deletes) a product with orders; hard-deletes one without', async () => {
    const refs = await base();
    const staff = await createStaff('PRODUCT_MANAGER');
    const ordered = await seedProduct({ name: 'Ordered Boot', sku: 'SX-ORD-1', ...refs, price: 30000, variants: [{ color: 'Black', size: '41', stock: 5 }] });
    const fresh = await seedProduct({ name: 'Fresh Boot', sku: 'SX-NEW-1', ...refs, price: 30000, variants: [{ color: 'Black', size: '41', stock: 5 }] });
    const c = await registerCustomer();
    await putInCart(c.user.id, [{ variantId: ordered.variants[0].id, quantity: 1 }]);
    const order = await api().post('/api/v1/orders').set(auth(c.token)).send({ shippingMethod: 'standard', paymentMethod: 'CASH_ON_DELIVERY', address });
    expect(order.status).toBe(201);

    const a = await api().delete(`/api/v1/admin/products/${ordered.id}`).set(auth(staff.token));
    expect(a.status).toBe(200);
    expect(a.body.data).toMatchObject({ result: 'ARCHIVED', archived: true, deleted: false });
    const row = await queryOne<{ status: string; deleted_at: Date | null }>(`select status, deleted_at from public.products where id = $1`, [ordered.id]);
    expect(row!.status).toBe('ARCHIVED');
    expect(row!.deleted_at).not.toBeNull();
    expect((await api().get('/api/v1/products/ordered-boot')).status).toBe(404);

    const d = await api().delete(`/api/v1/admin/products/${fresh.id}`).set(auth(staff.token));
    expect(d.body.data).toMatchObject({ result: 'DELETED', deleted: true });
    expect(await queryOne(`select 1 from public.products where id = $1`, [fresh.id])).toBeNull();
  });

  it('enforces permissions: ORDER_MANAGER cannot create products, PRODUCT_MANAGER can', async () => {
    const refs = await base();
    const om = await createStaff('ORDER_MANAGER');
    const denied = await api().post('/api/v1/admin/products').set(auth(om.token)).send(body(refs));
    expect(denied.status).toBe(403);
    expect((await api().get('/api/v1/admin/products').set(auth(om.token))).status).toBe(200); // products:view
    expect((await api().post('/api/v1/admin/categories').set(auth(om.token)).send({ name: 'X' })).status).toBe(403);
    const customer = await registerCustomer();
    expect((await api().get('/api/v1/admin/products').set(auth(customer.token))).status).toBe(403);
    const pm = await createStaff('PRODUCT_MANAGER');
    expect((await api().post('/api/v1/admin/products').set(auth(pm.token)).send(body(refs))).status).toBe(201);
  });

  it('duplicates, bulk-updates and validates variant combos', async () => {
    const refs = await base();
    const staff = await createStaff('PRODUCT_MANAGER');
    const p = (await api().post('/api/v1/admin/products').set(auth(staff.token)).send(body(refs))).body.data;
    const dup = await api().post(`/api/v1/admin/products/${p.id}/duplicate`).set(auth(staff.token));
    expect(dup.status).toBe(201);
    expect(dup.body.data).toMatchObject({ name: 'Admin Boot (Copy)', status: 'DRAFT', totalStock: 0, variantsCount: 2 });
    expect(dup.body.data.sku).toMatch(/^SX-ADM-001-C[0-9A-F]{4}$/);

    const bulk = await api().patch('/api/v1/admin/products/bulk').set(auth(staff.token)).send({ ids: [p.id, dup.body.data.id], status: 'PUBLISHED' });
    expect(bulk.status).toBe(400); // no main images yet
    const bulkArchive = await api().patch('/api/v1/admin/products/bulk').set(auth(staff.token)).send({ ids: [p.id, dup.body.data.id], status: 'archived' });
    expect(bulkArchive.body.data.updated).toBe(2);

    const combo = await api().post(`/api/v1/admin/products/${p.id}/variants`).set(auth(staff.token)).send({ color: 'black', size: '41' });
    expect(combo.status).toBe(409);
    const v = await api().post(`/api/v1/admin/products/${p.id}/variants`).set(auth(staff.token)).send({ color: 'Red', size: '44', stock: 3 });
    expect(v.status).toBe(201);
    expect(v.body.data).toMatchObject({ sku: 'SX-ADM-001-RED-44', stock: 3 });
    const vp = await api().patch(`/api/v1/admin/products/${p.id}/variants/${v.body.data.id}`).set(auth(staff.token)).send({ stock: 10 });
    expect(vp.body.data.stock).toBe(10);
    expect((await api().delete(`/api/v1/admin/products/${p.id}/variants/${v.body.data.id}`).set(auth(staff.token))).status).toBe(200);
    expect((await api().get(`/api/v1/admin/products/${p.id}`).set(auth(staff.token))).body.data.variants).toHaveLength(2);
  });
});

describe('admin categories and brands', () => {
  beforeEach(resetData);

  it('creates, refuses cycles, refuses deleting categories with products or children, reorders', async () => {
    const staff = await createStaff('PRODUCT_MANAGER');
    const h = auth(staff.token);
    const parent = (await api().post('/api/v1/admin/categories').set(h).send({ name: 'Footwear' })).body.data;
    expect(parent).toMatchObject({ slug: 'footwear', status: 'active', depth: 0 });
    const child = (await api().post('/api/v1/admin/categories').set(h).send({ name: 'Boots', parentId: parent.id })).body.data;
    expect(child.depth).toBe(1);
    const taken = await api().post('/api/v1/admin/categories').set(h).send({ name: 'Other', slug: 'footwear' });
    expect(taken.status).toBe(409);

    const cycle = await api().patch(`/api/v1/admin/categories/${parent.id}`).set(h).send({ parentId: child.id });
    expect(cycle.status).toBe(400);

    const withChildren = await api().delete(`/api/v1/admin/categories/${parent.id}`).set(h);
    expect(withChildren.status).toBe(409);
    expect(withChildren.body.error.details.reason).toBe('has_children');

    const b = (await api().post('/api/v1/admin/brands').set(h).send({ name: 'SPORTX LAB', website: '' })).body.data;
    expect(b).toMatchObject({ slug: 'sportx-lab', productCount: 0, status: 'active' });
    expect((await api().post('/api/v1/admin/brands').set(h).send({ name: 'sportx lab' })).status).toBe(409);
    await seedProduct({ name: 'Lab Boot', sku: 'SX-LAB-1', brandId: b.id, categoryId: child.id, price: 1000, variants: [] });

    const withProducts = await api().delete(`/api/v1/admin/categories/${child.id}`).set(h);
    expect(withProducts.status).toBe(409);
    expect(withProducts.body.error.details.reason).toBe('has_products');
    expect((await api().delete(`/api/v1/admin/brands/${b.id}`).set(h)).status).toBe(409);

    const list = await api().get('/api/v1/admin/categories').set(h);
    expect(list.body.data.map((c: { slug: string; productCount: number; totalProductCount: number }) => [c.slug, c.productCount, c.totalProductCount])).toEqual([
      ['footwear', 0, 1],
      ['boots', 1, 1],
    ]);

    const sib = (await api().post('/api/v1/admin/categories').set(h).send({ name: 'Apparel' })).body.data;
    expect((await api().put('/api/v1/admin/categories/order').set(h).send({ ids: [sib.id, parent.id] })).status).toBe(200);
    expect((await api().get('/api/v1/categories')).body.data.map((c: { slug: string }) => c.slug)).toEqual(['apparel', 'footwear']);
    expect((await api().put('/api/v1/admin/categories/order').set(h).send({ ids: [sib.id, child.id] })).status).toBe(400);

    const off = await api().patch(`/api/v1/admin/categories/${sib.id}/status`).set(h).send({ status: 'inactive' });
    expect(off.body.data.status).toBe('inactive');
    expect((await api().get('/api/v1/categories')).body.data.map((c: { slug: string }) => c.slug)).toEqual(['footwear']);

    const img = await api().post(`/api/v1/admin/categories/${sib.id}/image`).set(h).attach('file', PNG_1x1, { filename: 'c.png', contentType: 'image/png' });
    expect(img.status).toBe(200);
    expect(img.body.data.imageUrl).toMatch(/\/uploads\/categories\//);
    expect((await api().delete(`/api/v1/admin/categories/${sib.id}`).set(h)).status).toBe(200);

    const logs = await query<{ action: string }>(`select distinct action from public.admin_activity_logs`);
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(['Category created', 'Category deleted', 'Categories reordered', 'Brand created', 'Category image uploaded']));
  });
});
