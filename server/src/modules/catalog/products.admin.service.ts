import type { Request } from 'express';
import type { PoolClient } from 'pg';
import crypto from 'node:crypto';
import { pool, query, queryOne, withTransaction, type Db } from '../../config/database.js';
import { AppError, badRequest, conflict, notFound } from '../../utils/errors.js';
import { offsetOf, pageMeta } from '../../utils/pagination.js';
import { slugify, uniqueSlug } from '../../utils/slug.js';
import { audit } from '../../services/audit.service.js';
import { storageService } from '../../services/storage/storage.service.js';
import { adjustStock } from '../inventory/inventory.core.js';
import { getStoreSettings } from '../settings/settings.service.js';
import { escapeLike } from './catalog.sql.js';
import {
  toAdminProduct,
  toAdminProductRow,
  toAdminVariant,
  toImage,
  type AdminProductRow,
  type AdminVariantRow,
  type ImageRow,
} from './catalog.mapper.js';
import type { AdminProductListQuery, ImageInput, ProductInput, VariantInput, VariantPatch } from './catalog.admin.schema.js';

type Status = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

const ADMIN_ROW_SQL = `select p.*, b.name as brand_name, c.name as category_name,
    coalesce(s.total_stock, 0)::int as total_stock, coalesce(s.available, 0)::int as available,
    coalesce(s.reserved, 0)::int as reserved, coalesce(s.threshold, 0)::int as threshold,
    coalesce(s.variants_count, 0)::int as variants_count,
    (select pi.url from public.product_images pi where pi.product_id = p.id order by (pi.role = 'MAIN') desc, pi.position limit 1) as main_image
  from public.products p
  join public.brands b on b.id = p.brand_id
  join public.categories c on c.id = p.category_id
  left join lateral (
    select sum(i.stock_quantity) as total_stock, sum(greatest(i.stock_quantity - i.reserved_quantity, 0)) as available,
           sum(i.reserved_quantity) as reserved, max(i.low_stock_threshold) as threshold, count(*) as variants_count
      from public.product_variants v left join public.inventory i on i.variant_id = v.id
     where v.product_id = p.id and v.deleted_at is null
  ) s on true`;

const STOCK_STATUS_SQL = `case when r.available <= 0 then 'OUT_OF_STOCK' when r.available <= r.threshold then 'LOW_STOCK' else 'IN_STOCK' end`;
const REVENUE_SQL = `(select coalesce(sum(oi.line_total), 0) from public.order_items oi join public.orders o on o.id = oi.order_id
   where oi.product_id = r.id and o.deleted_at is null and o.status not in ('CANCELLED', 'REFUNDED'))::bigint`;

const VARIANT_SQL = `select v.*, i.stock_quantity, i.reserved_quantity, i.low_stock_threshold
  from public.product_variants v left join public.inventory i on i.variant_id = v.id`;

const TYPE_DEPARTMENT: Record<string, string> = {
  footwear: 'footwear', apparel: 'apparel', jersey: 'apparel', shorts: 'apparel', tracksuit: 'apparel',
  bag: 'accessories', socks: 'accessories', gloves: 'accessories', ball: 'equipment', equipment: 'equipment',
};

// ───────────────────────── Loading ─────────────────────────

export async function loadAdminProduct(id: string, db: Db = pool) {
  const row = await queryOne<AdminProductRow>(`${ADMIN_ROW_SQL} where p.id = $1`, [id], db);
  if (!row) throw notFound('Product');
  const [variants, images, revenue] = await Promise.all([
    query<AdminVariantRow>(`${VARIANT_SQL} where v.product_id = $1 and v.deleted_at is null order by v.position, v.created_at`, [id], db),
    query<ImageRow>(`select * from public.product_images where product_id = $1 order by (role = 'MAIN') desc, position, created_at`, [id], db),
    queryOne<{ revenue: number }>(`select ${REVENUE_SQL.replace(/r\.id/g, '$1::uuid')} as revenue`, [id], db),
  ]);
  return toAdminProduct({ ...row, revenue: revenue?.revenue ?? 0 }, variants, images);
}

async function lockProduct(tx: PoolClient, id: string) {
  const row = await queryOne<{ id: string; sku: string; slug: string; name: string; price: number; compare_at_price: number | null; status: Status; published_at: Date | null; brand_id: string; category_id: string; deleted_at: Date | null }>(
    `select id, sku, slug, name, price, compare_at_price, status, published_at, brand_id, category_id, deleted_at from public.products where id = $1 for update`,
    [id],
    tx,
  );
  if (!row || row.deleted_at) throw notFound('Product');
  return row;
}

// ───────────────────────── Validation helpers ─────────────────────────

async function assertRefs(tx: Db, brandId?: string, categoryId?: string) {
  if (brandId && !(await queryOne(`select 1 from public.brands where id = $1`, [brandId], tx))) throw badRequest('Brand not found.', { field: 'brandId' });
  if (categoryId && !(await queryOne(`select 1 from public.categories where id = $1`, [categoryId], tx))) throw badRequest('Category not found.', { field: 'categoryId' });
}

async function assertProductSkuFree(tx: Db, sku: string, excludeId?: string) {
  const taken = await queryOne(`select 1 from public.products where sku = $1 and ($2::uuid is null or id <> $2::uuid)`, [sku, excludeId ?? null], tx);
  if (taken) throw conflict(`SKU ${sku} is already in use.`, { field: 'sku', value: sku });
}

/** Variant SKUs are globally unique (including soft-deleted variants). `own` = variant ids allowed to keep their SKU. */
async function assertVariantSkusFree(tx: Db, entries: { sku: string; field: string; variantId?: string }[]) {
  const seen = new Map<string, string>();
  for (const e of entries) {
    if (seen.has(e.sku)) throw conflict(`Duplicate variant SKU ${e.sku}.`, { field: e.field, value: e.sku });
    seen.set(e.sku, e.field);
  }
  if (!entries.length) return;
  const rows = await query<{ id: string; sku: string }>(`select id, sku from public.product_variants where sku = any($1::text[])`, [entries.map((e) => e.sku)], tx);
  for (const r of rows) {
    const e = entries.find((x) => x.sku === r.sku)!;
    if (e.variantId !== r.id) throw conflict(`SKU ${r.sku} is already in use.`, { field: e.field, value: r.sku });
  }
}

function assertCompareAt(price: number, compareAt: number | null | undefined) {
  if (compareAt != null && compareAt <= price) throw badRequest('Compare-at price must be higher than the price.', { field: 'compareAtPrice' });
}

function assertUniqueCombos(variants: { color: string; size: string }[]) {
  const seen = new Set<string>();
  variants.forEach((v, i) => {
    const key = `${v.color.toLowerCase()}|${v.size.toLowerCase()}`;
    if (seen.has(key)) throw badRequest(`Duplicate variant ${v.color} / ${v.size}.`, { field: `variants.${i}` });
    seen.add(key);
  });
}

const token = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function generateVariantSku(productSku: string, v: { color: string; size: string }, taken: Set<string>) {
  const base = `${productSku}-${token(v.color).slice(0, 8) || 'C'}-${token(v.size).slice(0, 8) || 'S'}`.slice(0, 58).replace(/-+$/, '');
  let sku = base;
  for (let i = 2; taken.has(sku); i++) sku = `${base}-${i}`;
  taken.add(sku);
  return sku;
}

async function deriveDepartment(tx: Db, categoryId: string, productType?: string): Promise<string> {
  const root = await queryOne<{ slug: string }>(
    `with recursive up as (
       select id, parent_id, slug, 0 as d from public.categories where id = $1
       union all select c.id, c.parent_id, c.slug, up.d + 1 from public.categories c join up on c.id = up.parent_id where up.d < 20
     ) select slug from up where slug = any(array['footwear','apparel','equipment','accessories']) order by d limit 1`,
    [categoryId],
    tx,
  );
  return root?.slug ?? (productType ? TYPE_DEPARTMENT[productType] : undefined) ?? 'apparel';
}

async function assertPublishable(tx: Db, productIds: string[]) {
  const bad = await query<{ id: string; name: string; has_variant: boolean; has_main: boolean }>(
    `select p.id, p.name,
            exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active and v.deleted_at is null) as has_variant,
            exists (select 1 from public.product_images i where i.product_id = p.id and i.role = 'MAIN') as has_main
       from public.products p where p.id = any($1::uuid[])`,
    [productIds],
    tx,
  );
  const failing = bad.filter((b) => !b.has_variant || !b.has_main);
  if (failing.length) {
    const missing = (b: (typeof failing)[number]) => [!b.has_variant && 'an active variant', !b.has_main && 'a main image'].filter(Boolean).join(' and ');
    throw new AppError('VALIDATION_ERROR', failing.length === 1 ? `Add ${missing(failing[0])} before publishing.` : 'Some products cannot be published yet.', {
      products: failing.map((b) => ({ id: b.id, name: b.name, missingVariant: !b.has_variant, missingMainImage: !b.has_main })),
    });
  }
}

// ───────────────────────── Variants ─────────────────────────

async function insertVariant(tx: PoolClient, productId: string, sku: string, v: VariantInput | (VariantPatch & { color: string; size: string }), position: number, adminId: string | null, defaultThreshold: number) {
  const row = await queryOne<{ id: string }>(
    `insert into public.product_variants (product_id, sku, color, color_hex, size, price, compare_at_price, weight_grams, barcode, position, is_active)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
    [productId, sku, v.color, (v.colorHex ?? '#141414').toUpperCase(), v.size, v.price ?? null, v.compareAtPrice ?? null, v.weightGrams ?? null, v.barcode || null, v.position ?? position, v.isActive ?? true],
    tx,
  );
  await query(`insert into public.inventory (variant_id, stock_quantity, low_stock_threshold) values ($1, 0, $2)`, [row!.id, v.lowStockThreshold ?? defaultThreshold], tx);
  if (v.stock && v.stock > 0) {
    await adjustStock(tx, { variantId: row!.id, mode: 'set', quantity: v.stock, reason: 'RESTOCK', note: 'Initial stock', adminId });
  }
  return row!.id;
}

async function updateVariant(tx: PoolClient, existing: AdminVariantRow, v: VariantPatch, adminId: string | null) {
  const sets: string[] = [];
  const params: unknown[] = [existing.id];
  const set = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (v.sku !== undefined && v.sku !== existing.sku) set('sku', v.sku);
  if (v.color !== undefined) set('color', v.color);
  if (v.colorHex !== undefined) set('color_hex', v.colorHex.toUpperCase());
  if (v.size !== undefined) set('size', v.size);
  if (v.price !== undefined) set('price', v.price);
  if (v.compareAtPrice !== undefined) set('compare_at_price', v.compareAtPrice);
  if (v.weightGrams !== undefined) set('weight_grams', v.weightGrams);
  if (v.barcode !== undefined) set('barcode', v.barcode || null);
  if (v.position !== undefined) set('position', v.position);
  if (v.isActive !== undefined) set('is_active', v.isActive);
  if (sets.length) await query(`update public.product_variants set ${sets.join(', ')} where id = $1`, params, tx);

  const current = existing.stock_quantity ?? 0;
  if (v.stock !== undefined && v.stock !== current) {
    // Stock edits always go through the inventory core so a movement is logged.
    await adjustStock(tx, {
      variantId: existing.id,
      mode: 'set',
      quantity: v.stock,
      reason: v.stock > current ? 'RESTOCK' : 'MANUAL_ADJUSTMENT',
      note: 'Product edit',
      adminId,
      lowStockThreshold: v.lowStockThreshold,
    });
  } else if (v.lowStockThreshold !== undefined && v.lowStockThreshold !== existing.low_stock_threshold) {
    await query(`update public.inventory set low_stock_threshold = $2 where variant_id = $1`, [existing.id, v.lowStockThreshold], tx);
  }
}

async function softDeleteVariant(tx: PoolClient, v: AdminVariantRow) {
  if ((v.reserved_quantity ?? 0) > 0) {
    throw conflict(`Variant ${v.sku} has ${v.reserved_quantity} unit(s) reserved for open orders and cannot be removed.`, { field: 'variants', variantId: v.id, sku: v.sku });
  }
  await query(`update public.product_variants set deleted_at = now(), is_active = false where id = $1`, [v.id], tx);
  await query(`delete from public.cart_items where variant_id = $1`, [v.id], tx);
}

/** Replaces the variant set: matched by id (or SKU) → update, new → create, missing → soft delete. */
async function syncVariants(tx: PoolClient, productId: string, productSku: string, inputs: VariantInput[], adminId: string | null) {
  assertUniqueCombos(inputs);
  const existing = await query<AdminVariantRow>(`${VARIANT_SQL} where v.product_id = $1 and v.deleted_at is null for update of v`, [productId], tx);
  const byId = new Map(existing.map((v) => [v.id, v]));
  const bySku = new Map(existing.map((v) => [v.sku, v]));
  const taken = new Set(inputs.map((v) => v.sku).filter((s): s is string => Boolean(s)));
  const plan = inputs.map((input, i) => {
    let match: AdminVariantRow | undefined;
    if (input.id) {
      match = byId.get(input.id);
      if (!match) throw badRequest('Variant does not belong to this product.', { field: `variants.${i}.id` });
    } else if (input.sku) match = bySku.get(input.sku);
    const sku = input.sku ?? match?.sku ?? generateVariantSku(productSku, input, taken);
    return { input: { ...input, sku }, match, field: `variants.${i}.sku` };
  });
  await assertVariantSkusFree(tx, plan.map((p) => ({ sku: p.input.sku, field: p.field, variantId: p.match?.id })));

  const keep = new Set(plan.map((p) => p.match?.id).filter(Boolean));
  for (const v of existing) if (!keep.has(v.id)) await softDeleteVariant(tx, v);
  // Park changed combos first so swapping colour/size between two variants cannot hit the unique index.
  for (const p of plan) {
    if (p.match && (p.input.color.toLowerCase() !== p.match.color.toLowerCase() || p.input.size.toLowerCase() !== p.match.size.toLowerCase())) {
      await query(`update public.product_variants set size = size || '#' || $2 where id = $1`, [p.match.id, crypto.randomBytes(4).toString('hex')], tx);
    }
  }
  const { lowStockDefault } = await getStoreSettings(tx);
  let position = 0;
  for (const p of plan) {
    if (p.match) await updateVariant(tx, p.match, { ...p.input, position: p.input.position ?? position }, adminId);
    else await insertVariant(tx, productId, p.input.sku, p.input, position, adminId, lowStockDefault);
    position++;
  }
}

// ───────────────────────── Images (URL based, from the product form) ─────────────────────────

/** Replaces the product's image set with URL-based entries. Returns storage paths to delete after commit. */
async function syncImages(tx: PoolClient, productId: string, inputs: ImageInput[]): Promise<string[]> {
  const existing = await query<ImageRow>(`select * from public.product_images where product_id = $1`, [productId], tx);
  const byId = new Map(existing.map((i) => [i.id, i]));
  const keepIds = new Set(inputs.map((i) => i.id).filter((id): id is string => Boolean(id && byId.has(id))));
  const removed = existing.filter((e) => !keepIds.has(e.id));
  if (removed.length) await query(`delete from public.product_images where id = any($1::uuid[])`, [removed.map((r) => r.id)], tx);
  // Clear MAIN first so the partial unique index never sees two mains mid-update.
  await query(`update public.product_images set role = 'GALLERY' where product_id = $1 and role = 'MAIN'`, [productId], tx);
  let mainAssigned = false;
  const roles = inputs.map((i) => {
    const role = (i.role as ImageRow['role'] | undefined) ?? 'GALLERY';
    if (role === 'MAIN' && mainAssigned) return 'GALLERY';
    if (role === 'MAIN') mainAssigned = true;
    return role;
  });
  if (!mainAssigned && inputs.length) roles[0] = 'MAIN';
  for (const [idx, img] of inputs.entries()) {
    const params = [img.alt ?? '', roles[idx], img.color ?? null, img.position ?? idx];
    if (img.id && byId.has(img.id)) {
      await query(`update public.product_images set url = $2, alt = $3, role = $4, color = $5, position = $6 where id = $1`, [img.id, img.url, ...params], tx);
    } else {
      await query(`insert into public.product_images (product_id, url, alt, role, color, position) values ($1, $2, $3, $4, $5, $6)`, [productId, img.url, ...params], tx);
    }
  }
  return removed.map((r) => r.storage_path).filter((p): p is string => Boolean(p));
}

// ───────────────────────── Status ─────────────────────────

async function applyStatus(tx: PoolClient, ids: string[], status: Status) {
  if (status === 'PUBLISHED') await assertPublishable(tx, ids);
  await query(
    `update public.products set status = $2::public.product_status,
            published_at = case when $2::text = 'PUBLISHED' then coalesce(published_at, now()) else published_at end
      where id = any($1::uuid[])`,
    [ids, status],
    tx,
  );
}

const statusAction = (s: Status) => (s === 'PUBLISHED' ? 'Product published' : s === 'ARCHIVED' ? 'Product archived' : 'Product unpublished');

// ───────────────────────── Delete ─────────────────────────

/** Hard delete when the product was never ordered; otherwise archive + soft delete (order history keeps its reference). */
async function deleteOne(tx: PoolClient, req: Request, id: string): Promise<{ id: string; result: 'DELETED' | 'ARCHIVED'; paths: string[] }> {
  const cur = await lockProduct(tx, id);
  const ordered = await queryOne(`select 1 from public.order_items where product_id = $1 limit 1`, [id], tx);
  if (ordered) {
    const reserved = await queryOne<{ n: number }>(
      `select coalesce(sum(i.reserved_quantity), 0)::int as n from public.inventory i join public.product_variants v on v.id = i.variant_id where v.product_id = $1`,
      [id],
      tx,
    );
    await query(`update public.products set status = 'ARCHIVED', deleted_at = now() where id = $1`, [id], tx);
    await query(`update public.product_variants set is_active = false where product_id = $1`, [id], tx);
    await query(`delete from public.cart_items where product_id = $1`, [id], tx);
    await audit(req, { action: 'Product archived', entityType: 'product', entityId: id, metadata: { name: cur.name, sku: cur.sku, reason: 'deleted with order history', reservedUnits: reserved?.n ?? 0 } }, tx);
    return { id, result: 'ARCHIVED', paths: [] };
  }
  const images = await query<{ storage_path: string | null }>(`select storage_path from public.product_images where product_id = $1`, [id], tx);
  await query(`delete from public.products where id = $1`, [id], tx);
  await audit(req, { action: 'Product deleted', entityType: 'product', entityId: id, metadata: { name: cur.name, sku: cur.sku } }, tx);
  return { id, result: 'DELETED', paths: images.map((i) => i.storage_path).filter((p): p is string => Boolean(p)) };
}

const removeAll = (paths: string[]) => Promise.all(paths.map((p) => storageService.remove(p)));

// ───────────────────────── Service ─────────────────────────

export const adminProductsService = {
  get: (id: string) => loadAdminProduct(id),

  async list(f: AdminProductListQuery) {
    const where = ['true'];
    const params: unknown[] = [];
    const add = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    if (!f.includeDeleted) where.push('p.deleted_at is null');
    if (f.search) {
      const like = add(`%${escapeLike(f.search)}%`);
      where.push(`(p.name ilike ${like} or p.sku ilike ${like} or p.slug ilike ${like} or b.name ilike ${like} or c.name ilike ${like}
        or exists (select 1 from public.product_variants sv where sv.product_id = p.id and sv.deleted_at is null and (sv.sku ilike ${like} or sv.barcode ilike ${like})))`);
    }
    if (f.categoryId) {
      where.push(`p.category_id in (with recursive t as (select id from public.categories where id = ${add(f.categoryId)}::uuid
        union select c2.id from public.categories c2 join t on c2.parent_id = t.id) select id from t)`);
    }
    if (f.brandId) where.push(`p.brand_id = ${add(f.brandId)}::uuid`);
    if (f.status) where.push(`p.status = ${add(f.status)}::public.product_status`);
    if (f.sport) where.push(`p.sport = ${add(f.sport)}`);
    if (f.gender) where.push(`p.gender = ${add(f.gender)}::public.product_gender`);
    if (f.minPrice !== undefined) where.push(`p.price >= ${add(f.minPrice)}::bigint`);
    if (f.maxPrice !== undefined) where.push(`p.price <= ${add(f.maxPrice)}::bigint`);
    const outer = f.stock ? `where ${STOCK_STATUS_SQL} = ${add(f.stock)}` : '';

    const sort = f.sort ?? 'updated';
    const dir = f.order ?? (sort === 'name' ? 'asc' : 'desc');
    const col: Record<string, string> = {
      newest: 'r.created_at desc',
      oldest: 'r.created_at asc',
      price: `r.price ${dir}`,
      stock: `r.total_stock ${dir}`,
      sales: `r.units_sold ${dir}`,
      name: `lower(r.name) ${dir}`,
      updated: `r.updated_at ${dir}`,
    };
    const base = `with r as (${ADMIN_ROW_SQL} where ${where.join(' and ')}) `;
    const n = params.length;
    const [countRow, rows] = await Promise.all([
      queryOne<{ n: number }>(`${base} select count(*)::int as n from r ${outer}`, params),
      query<AdminProductRow>(
        `${base} select r.*, ${REVENUE_SQL} as revenue from r ${outer} order by ${col[sort]}, r.id limit $${n + 1} offset $${n + 2}`,
        [...params, f.limit, offsetOf(f.page, f.limit)],
      ),
    ]);
    return { items: rows.map(toAdminProductRow), meta: pageMeta(f.page, f.limit, countRow?.n ?? 0) };
  },

  async create(req: Request, input: ProductInput & { name: string; sku: string; brandId: string; categoryId: string; sport: string; price: number }) {
    const adminId = req.auth!.userId;
    assertCompareAt(input.price, input.compareAtPrice);
    const variants = input.variants ?? [];
    assertUniqueCombos(variants);
    const id = await withTransaction(async (tx) => {
      await assertRefs(tx, input.brandId, input.categoryId);
      await assertProductSkuFree(tx, input.sku);
      const taken = new Set(variants.map((v) => v.sku).filter((s): s is string => Boolean(s)));
      const skus = variants.map((v) => v.sku ?? generateVariantSku(input.sku, v, taken));
      await assertVariantSkusFree(tx, skus.map((sku, i) => ({ sku, field: `variants.${i}.sku` })));
      const slug = await uniqueSlug(tx, 'products', input.slug || input.name);
      const department = input.department ?? (await deriveDepartment(tx, input.categoryId, input.productType));
      const row = await queryOne<{ id: string }>(
        `insert into public.products (name, slug, sku, short_description, description, brand_id, category_id, department, sport, gender, product_type,
           price, compare_at_price, cost_price, tax_rate, status, is_featured, is_new, badge, features, specifications, tags, size_guide,
           complete_the_look, seo_title, seo_description, popularity)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'DRAFT',$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26) returning id`,
        [
          input.name, slug, input.sku, input.shortDescription ?? '', input.description ?? '', input.brandId, input.categoryId, department,
          input.sport, input.gender ?? 'UNISEX', input.productType ?? department, input.price, input.compareAtPrice ?? null, input.costPrice ?? null,
          input.taxRate ?? null, input.isFeatured ?? false, input.isNew ?? false, input.badge ?? null, input.features ?? [],
          JSON.stringify(input.specifications ?? []), input.tags ?? [], input.sizeGuide ?? 'none', input.completeTheLook ?? [],
          input.seoTitle ?? null, input.seoDescription ?? null, input.popularity ?? 0,
        ],
        tx,
      );
      const productId = row!.id;
      const { lowStockDefault } = await getStoreSettings(tx);
      for (const [i, v] of variants.entries()) await insertVariant(tx, productId, skus[i], v, i, adminId, lowStockDefault);
      if (input.images?.length) await syncImages(tx, productId, input.images);
      if (input.status && input.status !== 'DRAFT') await applyStatus(tx, [productId], input.status);
      await audit(req, { action: 'Product created', entityType: 'product', entityId: productId, metadata: { name: input.name, sku: input.sku, variants: variants.length, status: input.status ?? 'DRAFT' } }, tx);
      return productId;
    });
    return loadAdminProduct(id);
  },

  async update(req: Request, id: string, input: ProductInput) {
    const adminId = req.auth!.userId;
    let removedPaths: string[] = [];
    await withTransaction(async (tx) => {
      const cur = await lockProduct(tx, id);
      await assertRefs(tx, input.brandId, input.categoryId);
      if (input.sku !== undefined && input.sku !== cur.sku) await assertProductSkuFree(tx, input.sku, id);
      assertCompareAt(input.price ?? cur.price, input.compareAtPrice !== undefined ? input.compareAtPrice : input.price !== undefined ? cur.compare_at_price : undefined);

      const sets: string[] = [];
      const params: unknown[] = [id];
      const set = (col: string, v: unknown) => {
        params.push(v);
        sets.push(`${col} = $${params.length}`);
      };
      if (input.slug !== undefined) {
        const wanted = slugify(input.slug || input.name || cur.name);
        if (wanted !== cur.slug) set('slug', await uniqueSlug(tx, 'products', wanted, id));
      }
      const cols: [keyof ProductInput, string][] = [
        ['name', 'name'], ['sku', 'sku'], ['shortDescription', 'short_description'], ['description', 'description'], ['brandId', 'brand_id'],
        ['categoryId', 'category_id'], ['department', 'department'], ['sport', 'sport'], ['gender', 'gender'], ['productType', 'product_type'],
        ['price', 'price'], ['compareAtPrice', 'compare_at_price'], ['costPrice', 'cost_price'], ['taxRate', 'tax_rate'], ['isFeatured', 'is_featured'],
        ['isNew', 'is_new'], ['badge', 'badge'], ['features', 'features'], ['tags', 'tags'], ['sizeGuide', 'size_guide'],
        ['completeTheLook', 'complete_the_look'], ['seoTitle', 'seo_title'], ['seoDescription', 'seo_description'], ['popularity', 'popularity'],
      ];
      for (const [key, col] of cols) if (input[key] !== undefined) set(col, input[key]);
      if (input.specifications !== undefined) set('specifications', JSON.stringify(input.specifications));
      if (input.categoryId !== undefined && input.department === undefined && input.categoryId !== cur.category_id) {
        set('department', await deriveDepartment(tx, input.categoryId, input.productType));
      }
      if (sets.length) await query(`update public.products set ${sets.join(', ')} where id = $1`, params, tx);

      if (input.variants) await syncVariants(tx, id, input.sku ?? cur.sku, input.variants, adminId);
      if (input.images) removedPaths = await syncImages(tx, id, input.images);

      const nextStatus = input.status ?? cur.status;
      if (input.status && input.status !== cur.status) await applyStatus(tx, [id], input.status);
      else if (nextStatus === 'PUBLISHED' && (input.variants || input.images)) await assertPublishable(tx, [id]);

      await audit(req, { action: 'Product updated', entityType: 'product', entityId: id, metadata: { fields: Object.keys(input), name: input.name ?? cur.name } }, tx);
      if (input.status && input.status !== cur.status) await audit(req, { action: statusAction(input.status), entityType: 'product', entityId: id, metadata: { from: cur.status, to: input.status } }, tx);
    });
    await removeAll(removedPaths);
    return loadAdminProduct(id);
  },

  async setStatus(req: Request, id: string, status: Status) {
    await withTransaction(async (tx) => {
      const cur = await lockProduct(tx, id);
      await applyStatus(tx, [id], status);
      await audit(req, { action: statusAction(status), entityType: 'product', entityId: id, metadata: { from: cur.status, to: status, name: cur.name } }, tx);
    });
    return loadAdminProduct(id);
  },

  async remove(req: Request, id: string) {
    const out = await withTransaction((tx) => deleteOne(tx, req, id));
    await removeAll(out.paths);
    return { id, result: out.result, deleted: out.result === 'DELETED', archived: out.result === 'ARCHIVED' };
  },

  async bulkDelete(req: Request, ids: string[]) {
    const results = await withTransaction(async (tx) => {
      const out: Awaited<ReturnType<typeof deleteOne>>[] = [];
      for (const id of [...new Set(ids)].sort()) out.push(await deleteOne(tx, req, id));
      await audit(req, { action: 'Products bulk deleted', entityType: 'product', metadata: { ids, count: out.length } }, tx);
      return out;
    });
    await removeAll(results.flatMap((r) => r.paths));
    return { deleted: results.filter((r) => r.result === 'DELETED').map((r) => r.id), archived: results.filter((r) => r.result === 'ARCHIVED').map((r) => r.id) };
  },

  async bulkUpdate(req: Request, body: { ids: string[]; status?: Status; categoryId?: string }) {
    const ids = [...new Set(body.ids)];
    return withTransaction(async (tx) => {
      const found = await query<{ id: string }>(`select id from public.products where id = any($1::uuid[]) and deleted_at is null for update`, [ids], tx);
      if (found.length !== ids.length) throw notFound('Product');
      if (body.categoryId) {
        await assertRefs(tx, undefined, body.categoryId);
        const department = await deriveDepartment(tx, body.categoryId);
        await query(`update public.products set category_id = $2, department = $3 where id = any($1::uuid[])`, [ids, body.categoryId, department], tx);
      }
      if (body.status) await applyStatus(tx, ids, body.status);
      await audit(req, { action: 'Products bulk updated', entityType: 'product', metadata: { ids, status: body.status, categoryId: body.categoryId } }, tx);
      return { updated: ids.length };
    });
  },

  async duplicate(req: Request, id: string) {
    const newId = await withTransaction(async (tx) => {
      const src = await lockProduct(tx, id);
      const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
      const sku = `${src.sku.slice(0, 35)}-C${suffix}`;
      await assertProductSkuFree(tx, sku);
      const slug = await uniqueSlug(tx, 'products', `${src.slug}-copy`);
      const row = await queryOne<{ id: string }>(
        `insert into public.products (name, slug, sku, short_description, description, brand_id, category_id, department, sport, gender, product_type,
           price, compare_at_price, cost_price, tax_rate, status, is_featured, is_new, badge, features, specifications, tags, size_guide,
           complete_the_look, seo_title, seo_description)
         select left(name || ' (Copy)', 160), $2, $3, short_description, description, brand_id, category_id, department, sport, gender, product_type,
           price, compare_at_price, cost_price, tax_rate, 'DRAFT', false, is_new, badge, features, specifications, tags, size_guide,
           complete_the_look, seo_title, seo_description
           from public.products where id = $1 returning id`,
        [id, slug, sku],
        tx,
      );
      const newProductId = row!.id;
      const variants = await query<{ id: string; sku: string; low_stock_threshold: number | null }>(
        `select v.id, v.sku, i.low_stock_threshold from public.product_variants v left join public.inventory i on i.variant_id = v.id
          where v.product_id = $1 and v.deleted_at is null order by v.position`,
        [id],
        tx,
      );
      for (const v of variants) {
        const vr = await queryOne<{ id: string }>(
          `insert into public.product_variants (product_id, sku, color, color_hex, size, price, compare_at_price, weight_grams, barcode, position, is_active)
           select $2, $3, color, color_hex, size, price, compare_at_price, weight_grams, null, position, is_active from public.product_variants where id = $1 returning id`,
          [v.id, newProductId, `${v.sku.slice(0, 55)}-C${suffix}`],
          tx,
        );
        await query(`insert into public.inventory (variant_id, stock_quantity, low_stock_threshold) values ($1, 0, $2)`, [vr!.id, v.low_stock_threshold ?? 5], tx);
      }
      // Images are shared by URL; the copy has no storage path so deleting it never removes the original's file.
      await query(
        `insert into public.product_images (product_id, url, storage_path, alt, role, color, position)
         select $2, url, null, alt, role, color, position from public.product_images where product_id = $1`,
        [id, newProductId],
        tx,
      );
      await audit(req, { action: 'Product duplicated', entityType: 'product', entityId: newProductId, metadata: { sourceId: id, sku } }, tx);
      return newProductId;
    });
    return loadAdminProduct(newId);
  },

  async isUnique(field: 'sku' | 'slug', value: string, excludeId?: string) {
    if (field === 'slug') {
      const slug = slugify(value);
      const row = await queryOne(`select 1 from public.products where slug = $1 and ($2::uuid is null or id <> $2::uuid)`, [slug, excludeId ?? null]);
      return { field, value: slug, unique: !row };
    }
    const sku = value.toUpperCase();
    const row = await queryOne(
      `select 1 from public.products where sku = $1 and ($2::uuid is null or id <> $2::uuid)
       union all
       select 1 from public.product_variants where sku = $1 and ($2::uuid is null or product_id <> $2::uuid)
       limit 1`,
      [sku, excludeId ?? null],
    );
    return { field, value: sku, unique: !row };
  },

  // ─── Variants ───

  async addVariant(req: Request, productId: string, input: VariantInput) {
    const variantId = await withTransaction(async (tx) => {
      const product = await lockProduct(tx, productId);
      const dup = await queryOne(
        `select 1 from public.product_variants where product_id = $1 and deleted_at is null and lower(color) = lower($2) and lower(size) = lower($3)`,
        [productId, input.color, input.size],
        tx,
      );
      if (dup) throw conflict(`A ${input.color} / ${input.size} variant already exists.`, { field: 'size' });
      const existingSkus = await query<{ sku: string }>(`select sku from public.product_variants where product_id = $1`, [productId], tx);
      const sku = input.sku ?? generateVariantSku(product.sku, input, new Set(existingSkus.map((s) => s.sku)));
      await assertVariantSkusFree(tx, [{ sku, field: 'sku' }]);
      const pos = await queryOne<{ n: number }>(`select coalesce(max(position) + 1, 0)::int as n from public.product_variants where product_id = $1`, [productId], tx);
      const { lowStockDefault } = await getStoreSettings(tx);
      const id = await insertVariant(tx, productId, sku, input, pos!.n, req.auth!.userId, lowStockDefault);
      await audit(req, { action: 'Variant created', entityType: 'product_variant', entityId: id, metadata: { productId, sku, color: input.color, size: input.size, stock: input.stock ?? 0 } }, tx);
      return id;
    });
    return this.getVariant(productId, variantId);
  },

  async getVariant(productId: string, variantId: string) {
    const row = await queryOne<AdminVariantRow>(`${VARIANT_SQL} where v.id = $1 and v.product_id = $2 and v.deleted_at is null`, [variantId, productId]);
    if (!row) throw notFound('Variant');
    return toAdminVariant(row);
  },

  async updateVariant(req: Request, productId: string, variantId: string, patch: VariantPatch) {
    await withTransaction(async (tx) => {
      await lockProduct(tx, productId);
      const existing = await queryOne<AdminVariantRow>(`${VARIANT_SQL} where v.id = $1 and v.product_id = $2 and v.deleted_at is null for update of v`, [variantId, productId], tx);
      if (!existing) throw notFound('Variant');
      if (patch.sku !== undefined && patch.sku !== existing.sku) await assertVariantSkusFree(tx, [{ sku: patch.sku, field: 'sku', variantId }]);
      if (patch.color !== undefined || patch.size !== undefined) {
        const dup = await queryOne(
          `select 1 from public.product_variants where product_id = $1 and id <> $2 and deleted_at is null and lower(color) = lower($3) and lower(size) = lower($4)`,
          [productId, variantId, patch.color ?? existing.color, patch.size ?? existing.size],
          tx,
        );
        if (dup) throw conflict(`A ${patch.color ?? existing.color} / ${patch.size ?? existing.size} variant already exists.`, { field: 'size' });
      }
      await updateVariant(tx, existing, patch, req.auth!.userId);
      await audit(req, { action: 'Variant updated', entityType: 'product_variant', entityId: variantId, metadata: { productId, fields: Object.keys(patch) } }, tx);
    });
    return this.getVariant(productId, variantId);
  },

  async deleteVariant(req: Request, productId: string, variantId: string) {
    await withTransaction(async (tx) => {
      await lockProduct(tx, productId);
      const existing = await queryOne<AdminVariantRow>(`${VARIANT_SQL} where v.id = $1 and v.product_id = $2 and v.deleted_at is null for update of v`, [variantId, productId], tx);
      if (!existing) throw notFound('Variant');
      await softDeleteVariant(tx, existing);
      await audit(req, { action: 'Variant deleted', entityType: 'product_variant', entityId: variantId, metadata: { productId, sku: existing.sku } }, tx);
    });
  },

  // ─── Uploaded images ───

  async uploadImage(req: Request, productId: string, file: Express.Multer.File, fields: { role?: string; color?: string; alt?: string }) {
    const product = await queryOne<{ id: string; name: string }>(`select id, name from public.products where id = $1 and deleted_at is null`, [productId]);
    if (!product) throw notFound('Product');
    const stored = await storageService.putImage('products', productId, file);
    try {
      const imageId = await withTransaction(async (tx) => {
        await query(`select id from public.products where id = $1 for update`, [productId], tx);
        const stats = await queryOne<{ n: number; next: number; has_main: boolean }>(
          `select count(*)::int as n, coalesce(max(position) + 1, 0)::int as next, bool_or(role = 'MAIN') as has_main
             from public.product_images where product_id = $1`,
          [productId],
          tx,
        );
        const role = (fields.role as ImageRow['role'] | undefined) ?? (stats!.has_main ? 'GALLERY' : 'MAIN');
        if (role === 'MAIN') await query(`update public.product_images set role = 'GALLERY' where product_id = $1 and role = 'MAIN'`, [productId], tx);
        const row = await queryOne<{ id: string }>(
          `insert into public.product_images (product_id, url, storage_path, alt, role, color, position) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
          [productId, stored.url, stored.path, fields.alt ?? product.name, role, fields.color ?? null, role === 'MAIN' ? 0 : stats!.next],
          tx,
        );
        await audit(req, { action: 'Image uploaded', entityType: 'product', entityId: productId, metadata: { imageId: row!.id, role, path: stored.path } }, tx);
        return row!.id;
      });
      const img = await queryOne<ImageRow>(`select * from public.product_images where id = $1`, [imageId]);
      return toImage(img!);
    } catch (err) {
      await storageService.remove(stored.path);
      throw err;
    }
  },

  async updateImage(req: Request, productId: string, imageId: string, patch: { role?: string; alt?: string; color?: string | null; position?: number }) {
    await withTransaction(async (tx) => {
      const img = await queryOne<ImageRow>(`select * from public.product_images where id = $1 and product_id = $2 for update`, [imageId, productId], tx);
      if (!img) throw notFound('Image');
      if (patch.role === 'MAIN' && img.role !== 'MAIN') await query(`update public.product_images set role = 'GALLERY' where product_id = $1 and role = 'MAIN'`, [productId], tx);
      await query(
        `update public.product_images set role = coalesce($2::public.image_role, role), alt = coalesce($3, alt),
                color = case when $4::boolean then $5 else color end, position = coalesce($6, position)
          where id = $1`,
        [imageId, patch.role ?? null, patch.alt ?? null, patch.color !== undefined, patch.color ?? null, patch.position ?? null],
        tx,
      );
      await audit(req, { action: 'Image updated', entityType: 'product', entityId: productId, metadata: { imageId, fields: Object.keys(patch) } }, tx);
    });
    const img = await queryOne<ImageRow>(`select * from public.product_images where id = $1`, [imageId]);
    return toImage(img!);
  },

  async reorderImages(req: Request, productId: string, ids: string[]) {
    await withTransaction(async (tx) => {
      const imgs = await query<{ id: string }>(`select id from public.product_images where product_id = $1 for update`, [productId], tx);
      const own = new Set(imgs.map((i) => i.id));
      if (ids.length !== own.size || !ids.every((id) => own.has(id)) || new Set(ids).size !== ids.length) {
        throw badRequest('Provide every image id of this product exactly once.', { field: 'ids' });
      }
      await query(`update public.product_images i set position = (o.pos - 1)::int from unnest($1::uuid[]) with ordinality as o(id, pos) where i.id = o.id`, [ids], tx);
      await audit(req, { action: 'Images reordered', entityType: 'product', entityId: productId, metadata: { ids } }, tx);
    });
    const rows = await query<ImageRow>(`select * from public.product_images where product_id = $1 order by position`, [productId]);
    return rows.map(toImage);
  },

  async deleteImage(req: Request, productId: string, imageId: string) {
    const path = await withTransaction(async (tx) => {
      const img = await queryOne<ImageRow>(`select * from public.product_images where id = $1 and product_id = $2 for update`, [imageId, productId], tx);
      if (!img) throw notFound('Image');
      await query(`delete from public.product_images where id = $1`, [imageId], tx);
      if (img.role === 'MAIN') {
        // Promote the next image so a published product keeps a main image when one remains.
        await query(
          `update public.product_images set role = 'MAIN' where id = (select id from public.product_images where product_id = $1 order by position, created_at limit 1)`,
          [productId],
          tx,
        );
      }
      await audit(req, { action: 'Image deleted', entityType: 'product', entityId: productId, metadata: { imageId, url: img.url } }, tx);
      return img.storage_path;
    });
    await storageService.remove(path);
  },
};
