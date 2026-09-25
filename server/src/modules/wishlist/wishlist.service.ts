import { pool, query, queryOne, withTransaction, type Db } from '../../config/database.js';
import { conflict } from '../../utils/errors.js';
import { resolvePublishedProduct } from '../account/products.js';

const MAX_ITEMS = 200;

interface Row {
  product_id: string;
  added_at: Date;
  name: string;
  slug: string;
  brand_name: string;
  brand_slug: string;
  image_url: string | null;
  hover_image_url: string | null;
  price: number;
  compare_at_price: number | null;
  rating: number;
  review_count: number;
  badge: string | null;
  is_new: boolean;
  in_stock: boolean;
  colors: string[] | null;
}

function toItem(r: Row) {
  return {
    productId: r.product_id,
    addedAt: new Date(r.added_at).toISOString(),
    product: {
      id: r.product_id,
      name: r.name,
      slug: r.slug,
      brand: r.brand_name,
      brandSlug: r.brand_slug,
      image: r.image_url,
      hoverImage: r.hover_image_url,
      price: r.price,
      compareAtPrice: r.compare_at_price && r.compare_at_price > r.price ? r.compare_at_price : null,
      rating: Number(r.rating),
      reviewCount: r.review_count,
      badge: r.badge,
      isNew: r.is_new,
      inStock: r.in_stock,
      colors: r.colors ?? [],
    },
  };
}

async function ensureWishlist(db: Db, userId: string): Promise<string> {
  await query(`insert into public.wishlists (user_id) values ($1) on conflict (user_id) do nothing`, [userId], db);
  return (await queryOne<{ id: string }>(`select id from public.wishlists where user_id = $1`, [userId], db))!.id;
}

export const wishlistService = {
  /** Published products only; unpublished ones stay stored but are hidden until republished. */
  async get(userId: string, db: Db = pool) {
    const rows = await query<Row>(
      `select p.id as product_id, wi.created_at as added_at, p.name, p.slug, b.name as brand_name, b.slug as brand_slug,
              (select pi.url from public.product_images pi where pi.product_id = p.id order by (pi.role = 'MAIN') desc, pi.position limit 1) as image_url,
              (select pi.url from public.product_images pi where pi.product_id = p.id and pi.role = 'HOVER' order by pi.position limit 1) as hover_image_url,
              coalesce((select min(coalesce(v.price, p.price)) from public.product_variants v where v.product_id = p.id and v.is_active and v.deleted_at is null), p.price) as price,
              p.compare_at_price, p.rating, p.review_count, p.badge, p.is_new,
              exists (select 1 from public.product_variants v join public.inventory i on i.variant_id = v.id
                       where v.product_id = p.id and v.is_active and v.deleted_at is null and i.stock_quantity - i.reserved_quantity > 0) as in_stock,
              (select array_agg(distinct v.color) from public.product_variants v where v.product_id = p.id and v.is_active and v.deleted_at is null) as colors
         from public.wishlists w
         join public.wishlist_items wi on wi.wishlist_id = w.id
         join public.products p on p.id = wi.product_id
         join public.brands b on b.id = p.brand_id
        where w.user_id = $1 and p.status = 'PUBLISHED' and p.deleted_at is null
        order by wi.created_at desc`,
      [userId],
      db,
    );
    const items = rows.map(toItem);
    return { ids: items.map((i) => i.productId), count: items.length, items };
  },

  async add(userId: string, productRef: string) {
    const product = await resolvePublishedProduct(productRef);
    await withTransaction(async (tx) => {
      const wishlistId = await ensureWishlist(tx, userId);
      await query(`select id from public.wishlists where id = $1 for update`, [wishlistId], tx);
      const n = await queryOne<{ n: number }>(`select count(*)::int as n from public.wishlist_items where wishlist_id = $1`, [wishlistId], tx);
      const exists = await queryOne(`select 1 from public.wishlist_items where wishlist_id = $1 and product_id = $2`, [wishlistId, product.id], tx);
      if (!exists && (n?.n ?? 0) >= MAX_ITEMS) throw conflict(`Your wishlist can hold up to ${MAX_ITEMS} products.`);
      await query(`insert into public.wishlist_items (wishlist_id, product_id) values ($1, $2) on conflict do nothing`, [wishlistId, product.id], tx);
    });
    return this.get(userId);
  },

  /** Removing is idempotent and accepts products that are no longer published. */
  async remove(userId: string, productRef: string) {
    await query(
      `delete from public.wishlist_items wi using public.wishlists w, public.products p
        where wi.wishlist_id = w.id and w.user_id = $1 and p.id = wi.product_id and (p.id::text = $2 or p.slug = lower($2))`,
      [userId, productRef.toLowerCase()],
    );
    return this.get(userId);
  },

  async check(userId: string, productRef: string) {
    const row = await queryOne(
      `select 1 from public.wishlists w join public.wishlist_items wi on wi.wishlist_id = w.id join public.products p on p.id = wi.product_id
        where w.user_id = $1 and (p.id::text = $2 or p.slug = lower($2)) and p.status = 'PUBLISHED' and p.deleted_at is null`,
      [userId, productRef.toLowerCase()],
    );
    return { inWishlist: Boolean(row) };
  },

  /** Union of the guest list and the account list. Unknown or unpublished products are skipped. */
  async merge(userId: string, productRefs: string[]) {
    const refs = [...new Set(productRefs.map((r) => r.trim().toLowerCase()))];
    const found = refs.length
      ? await query<{ id: string }>(
          `select id from public.products where (id::text = any($1::text[]) or slug = any($1::text[])) and status = 'PUBLISHED' and deleted_at is null`,
          [refs],
        )
      : [];
    await withTransaction(async (tx) => {
      const wishlistId = await ensureWishlist(tx, userId);
      await query(`select id from public.wishlists where id = $1 for update`, [wishlistId], tx);
      const n = await queryOne<{ n: number }>(`select count(*)::int as n from public.wishlist_items where wishlist_id = $1`, [wishlistId], tx);
      const room = Math.max(0, MAX_ITEMS - (n?.n ?? 0));
      const ids = found.map((f) => f.id).slice(0, room);
      if (ids.length) await query(`insert into public.wishlist_items (wishlist_id, product_id) select $1, unnest($2::uuid[]) on conflict do nothing`, [wishlistId, ids], tx);
    });
    return this.get(userId);
  },

  async count(userId: string, db: Db = pool) {
    const r = await queryOne<{ n: number }>(
      `select count(*)::int as n from public.wishlists w join public.wishlist_items wi on wi.wishlist_id = w.id join public.products p on p.id = wi.product_id
        where w.user_id = $1 and p.status = 'PUBLISHED' and p.deleted_at is null`,
      [userId],
      db,
    );
    return r?.n ?? 0;
  },
};
