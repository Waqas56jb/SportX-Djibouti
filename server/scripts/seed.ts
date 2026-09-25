/**
 * Development / demo seed. Idempotent: skips the catalogue if products already exist (use --force to
 * wipe and reload catalogue + promotions). Never seeds payment credentials or hard-coded passwords.
 *
 *   npm run db:seed
 *   npm run db:seed -- --force
 *
 * Optional demo accounts (only created when the variables are set):
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD            → SUPER_ADMIN
 *   SEED_DEMO_CUSTOMER_EMAIL / SEED_DEMO_CUSTOMER_PASSWORD → CUSTOMER
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, queryOne, withTransaction } from '../src/config/database.js';
import { provisionUser } from '../src/modules/auth/provisioning.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, here.split(path.sep).includes('dist') ? '../..' : '..');
const data = (f: string) => JSON.parse(fs.readFileSync(path.join(root, 'supabase/seed/data', f), 'utf8'));

interface SeedProduct {
  legacyId: string;
  name: string;
  slug: string;
  brand: string;
  department: 'footwear' | 'apparel' | 'equipment' | 'accessories';
  category: string;
  sport: string;
  gender: string[];
  shortDescription: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  images: { url: string; alt: string }[];
  colors: { name: string; hex: string; imageIndex?: number }[];
  variants: { sku: string; color: string; size: string; stock: number }[];
  features: string[];
  specifications: { label: string; value: string }[];
  badge: string | null;
  isNew: boolean;
  isBestSeller: boolean;
  popularity: number;
  createdAt: string;
  sizeGuide: string;
  tags: string[];
  completeTheLook: string[];
}

const BRANDS: Record<string, string> = {
  SPORTX: 'Everyday performance essentials for training and lifestyle.',
  'SPORTX PRO': 'Competition-grade footwear and apparel for serious athletes.',
  'SPORTX ELITE': 'Our most advanced range — engineered for match day.',
  'SPORTX ESSENTIALS': 'Durable basics and accessories for every kit bag.',
  'SPORTX LAB': 'Experimental technology and limited releases.',
};

const DEPARTMENTS: { slug: string; name: string; description: string }[] = [
  { slug: 'footwear', name: 'Footwear', description: 'Boots, court shoes, runners and trainers for every surface.' },
  { slug: 'apparel', name: 'Apparel', description: 'Jerseys, tees, shorts, tracksuits and training layers.' },
  { slug: 'equipment', name: 'Equipment', description: 'Balls, gloves and gym equipment.' },
  { slug: 'accessories', name: 'Accessories', description: 'Bags, caps, socks and wearables.' },
];

const titleCase = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function genderOf(g: string[]): string {
  const set = new Set(g);
  if (set.has('kids') && !set.has('men') && !set.has('women')) return 'KIDS';
  if (set.has('unisex') || (set.has('men') && set.has('women'))) return 'UNISEX';
  if (set.has('women')) return 'WOMEN';
  if (set.has('men')) return 'MEN';
  return 'UNISEX';
}

const TYPE_BY_CATEGORY: Record<string, string> = {
  'football-boots': 'footwear', 'basketball-shoes': 'footwear', 'running-shoes': 'footwear', 'training-shoes': 'footwear', 'lifestyle-shoes': 'footwear',
  jerseys: 'jersey', tees: 'apparel', shorts: 'shorts', tracksuits: 'tracksuit', hoodies: 'apparel', jackets: 'apparel', leggings: 'apparel', 'sports-bras': 'apparel',
  balls: 'ball', gloves: 'gloves', socks: 'socks', caps: 'apparel', bags: 'bag', 'gym-equipment': 'equipment', wearables: 'equipment',
};

async function seedCatalog(force: boolean) {
  const existing = await queryOne<{ n: number }>(`select count(*)::int as n from public.products`);
  if (existing!.n > 0 && !force) {
    console.log(`Catalogue already has ${existing!.n} products — skipping (use --force to reload).`);
    return;
  }
  const products = data('products.json') as SeedProduct[];
  const tiles = data('category-tiles.json') as { slug: string; image: string; description: string }[];
  const reviews = data('reviews.json') as { productLegacyId: string; author: string; rating: number; title: string; body: string; fit: string | null; size: string | null; createdAt: string }[];

  await withTransaction(async (tx) => {
    if (force) {
      console.log('Clearing catalogue and promotions…');
      await tx.query(`delete from public.reviews`);
      await tx.query(`delete from public.cart_items; delete from public.wishlist_items;`);
      await tx.query(`update public.order_items set product_id = null, variant_id = null`);
      await tx.query(`delete from public.inventory_movements; delete from public.products; delete from public.categories; delete from public.brands;`);
      await tx.query(`delete from public.coupons where created_by is null; delete from public.discounts; delete from public.flash_sales; delete from public.campaigns;`);
      await tx.query(`delete from public.users where email like '%@seed.sportx.invalid'`);
    }

    const brandId = new Map<string, string>();
    for (const [name, description] of Object.entries(BRANDS)) {
      const b = await queryOne<{ id: string }>(`insert into public.brands (name, slug, description) values ($1, $2, $3) returning id`, [name, slug(name), description], tx);
      brandId.set(name, b!.id);
    }

    const categoryId = new Map<string, string>();
    for (const [i, d] of DEPARTMENTS.entries()) {
      const tile = tiles.find((t) => t.slug === d.slug);
      const c = await queryOne<{ id: string }>(
        `insert into public.categories (name, slug, description, image_url, sort_order, seo_title, seo_description) values ($1, $2, $3, $4, $5, $6, $3) returning id`,
        [d.name, d.slug, d.description, tile?.image ?? null, i, `${d.name} | SPORTX Djibouti`],
        tx,
      );
      categoryId.set(d.slug, c!.id);
    }
    const subcats = [...new Map(products.map((p) => [p.category, p.department])).entries()];
    for (const [i, [cat, dept]] of subcats.entries()) {
      const tile = tiles.find((t) => t.slug === cat);
      const name = titleCase(cat);
      const c = await queryOne<{ id: string }>(
        `insert into public.categories (name, slug, parent_id, description, image_url, sort_order, seo_title, seo_description) values ($1, $2, $3, $4, $5, $6, $7, $4) returning id`,
        [name, cat, categoryId.get(dept), tile?.description ?? `${name} at SPORTX Djibouti.`, tile?.image ?? null, i, `${name} | SPORTX Djibouti`],
        tx,
      );
      categoryId.set(cat, c!.id);
    }

    const productId = new Map<string, string>();
    for (const p of products) {
      const sku = p.legacyId.toUpperCase();
      const row = await queryOne<{ id: string }>(
        `insert into public.products (name, slug, sku, short_description, description, brand_id, category_id, department, sport, gender, product_type,
           price, compare_at_price, cost_price, status, is_featured, is_new, badge, features, specifications, tags, size_guide, popularity,
           seo_title, seo_description, published_at, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'PUBLISHED',$15,$16,$17,$18,$19,$20,$21,$22,$23,$4,$24,$24) returning id`,
        [
          p.name, p.slug, sku, p.shortDescription, p.description, brandId.get(p.brand), categoryId.get(p.category), p.department, p.sport,
          genderOf(p.gender), TYPE_BY_CATEGORY[p.category] ?? 'apparel', p.price, p.compareAtPrice, Math.round((p.price * 0.55) / 100) * 100,
          p.isBestSeller, p.isNew, p.badge, p.features, JSON.stringify(p.specifications), p.tags, p.sizeGuide, p.popularity,
          `${p.name} | SPORTX Djibouti`, new Date(p.createdAt).toISOString(),
        ],
        tx,
      );
      productId.set(p.legacyId, row!.id);

      for (const [i, img] of p.images.entries()) {
        const color = p.colors.find((c) => c.imageIndex === i && i > 0)?.name ?? null;
        await tx.query(`insert into public.product_images (product_id, url, alt, role, color, position) values ($1, $2, $3, $4, $5, $6)`, [
          row!.id, img.url, img.alt, i === 0 ? 'MAIN' : i === 1 && !color ? 'HOVER' : 'GALLERY', color, i,
        ]);
      }
      for (const [i, v] of p.variants.entries()) {
        const hex = p.colors.find((c) => c.name === v.color)?.hex ?? '#141414';
        const vr = await queryOne<{ id: string }>(
          `insert into public.product_variants (product_id, sku, color, color_hex, size, position) values ($1, $2, $3, $4, $5, $6) returning id`,
          [row!.id, v.sku.toUpperCase().replace(/[^A-Z0-9-]/g, '-'), v.color, hex.toUpperCase(), v.size, i],
          tx,
        );
        await tx.query(`insert into public.inventory (variant_id, stock_quantity, low_stock_threshold, last_restocked_at) values ($1, $2, 5, now() - ($3 || ' days')::interval)`, [vr!.id, v.stock, String((i * 7) % 90)]);
      }
    }
    for (const p of products) {
      const ids = p.completeTheLook.map((l) => productId.get(l)).filter(Boolean);
      if (ids.length) await tx.query(`update public.products set complete_the_look = $2 where id = $1`, [productId.get(p.legacyId), ids]);
    }

    // Demo reviewer profiles (no credentials — they cannot sign in) so ratings are computed from real review rows.
    const reviewer = new Map<string, string>();
    for (const [i, author] of [...new Set(reviews.map((r) => r.author))].entries()) {
      const [first, last] = author.split(' ');
      const u = await queryOne<{ id: string }>(
        `insert into public.users (first_name, last_name, email, status, notes, email_verified_at) values ($1, $2, $3, 'ACTIVE', 'Seed reviewer (demo data, no login)', now()) returning id`,
        [first, last ?? '.', `reviewer-${i + 1}@seed.sportx.invalid`],
        tx,
      );
      await tx.query(`insert into public.user_roles (user_id, role_id) select $1, id from public.roles where slug = 'CUSTOMER'`, [u!.id]);
      reviewer.set(author, u!.id);
    }
    let reviewCount = 0;
    for (const r of reviews) {
      const res = await tx.query(
        `insert into public.reviews (product_id, user_id, rating, title, comment, fit, size, status, verified_purchase, moderated_at, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, 'APPROVED', false, now(), $8) on conflict do nothing`,
        [productId.get(r.productLegacyId), reviewer.get(r.author), r.rating, r.title, r.body, r.fit, r.size, r.createdAt],
      );
      reviewCount += res.rowCount ?? 0;
    }
    console.log(`  ✓ ${brandId.size} brands, ${categoryId.size} categories, ${products.length} products, ${reviewCount} reviews`);

    // Demo promotions.
    await tx.query(
      `insert into public.coupons (code, description, type, value, minimum_order_amount, maximum_discount, per_user_limit, customer_groups) values
         ('WELCOME10', '10% off your first order', 'PERCENTAGE', 10, 5000, 5000, 1, '{new}'),
         ('TEAM5000', 'DJF 5,000 off team orders over DJF 40,000', 'FIXED', 5000, 40000, null, null, '{}'),
         ('MATCHDAY15', '15% off football boots and balls', 'PERCENTAGE', 15, 15000, 8000, 2, '{}')
       on conflict do nothing`,
    );
    await tx.query(`update public.coupons set category_ids = array[$1::uuid, $2::uuid] where code = 'MATCHDAY15'`, [categoryId.get('football-boots'), categoryId.get('balls')]);
    await tx.query(
      `insert into public.discounts (name, type, value, applies_to, target_ids, starts_at, ends_at) values ('Tracksuit season', 'PERCENTAGE', 10, 'CATEGORIES', array[$1::uuid], now(), now() + interval '30 days')`,
      [categoryId.get('tracksuits')],
    );
    console.log('  ✓ demo coupons (WELCOME10, TEAM5000, MATCHDAY15) and one automatic discount');
  });
}

async function seedAccounts() {
  const pairs: [string | undefined, string | undefined, string, string, string][] = [
    [process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD, 'SUPER_ADMIN', 'Store', 'Admin'],
    [process.env.SEED_DEMO_CUSTOMER_EMAIL, process.env.SEED_DEMO_CUSTOMER_PASSWORD, 'CUSTOMER', 'Demo', 'Customer'],
  ];
  for (const [email, password, role, first, last] of pairs) {
    if (!email || !password) continue;
    try {
      const r = await provisionUser({ email, password, firstName: first, lastName: last, roleSlug: role });
      console.log(`  ✓ ${role} ${email} ${r.created ? 'created' : 'role granted'}`);
    } catch (err) {
      console.log(`  • ${role} ${email}: ${(err as Error).message}`);
    }
  }
}

try {
  console.log('Seeding SPORTX…');
  await seedCatalog(process.argv.includes('--force'));
  await seedAccounts();
  console.log('Done.');
} catch (err) {
  console.error('Seed failed:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
