/**
 * One-off developer tool: exports the storefront's prototype catalogue (customer/src/data) to
 * supabase/seed/data/*.json so the database seed does not depend on frontend source code.
 * Re-run only if the prototype data changes:  npx tsx scripts/export-customer-catalog.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const customerRoot = path.resolve(here, '../../customer');
const out = path.resolve(here, '../supabase/seed/data');

const vite = await createServer({ root: customerRoot, configFile: path.join(customerRoot, 'vite.config.ts'), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
try {
  const { PRODUCTS } = (await vite.ssrLoadModule('/src/data/products.ts')) as { PRODUCTS: Record<string, unknown>[] };
  const cats = (await vite.ssrLoadModule('/src/data/categories.ts')) as Record<string, unknown>;
  const products = PRODUCTS.map((p) => ({
    legacyId: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    department: p.department,
    category: p.category,
    sport: p.sport,
    gender: p.gender,
    shortDescription: p.shortDescription,
    description: p.description,
    price: p.price,
    compareAtPrice: p.compareAtPrice ?? null,
    rating: p.rating,
    reviewCount: p.reviewCount,
    images: p.images,
    colors: p.colors,
    sizes: p.sizes,
    variants: (p.variants as { sku: string; color: string; size: string; stock: number }[]).map((v) => ({ sku: v.sku, color: v.color, size: v.size, stock: v.stock })),
    features: p.features,
    specifications: p.specifications,
    badge: p.badge ?? null,
    isNew: p.isNew,
    isBestSeller: p.isBestSeller,
    popularity: p.popularity,
    createdAt: p.createdAt,
    sizeGuide: p.sizeGuide,
    tags: p.tags,
    completeTheLook: p.completeTheLook ?? [],
  }));
  fs.writeFileSync(path.join(out, 'products.json'), JSON.stringify(products, null, 2));
  const tiles = [...((cats.FEATURED_CATEGORIES as unknown[]) ?? []), ...((cats.MORE_CATEGORIES as unknown[]) ?? [])];
  fs.writeFileSync(path.join(out, 'category-tiles.json'), JSON.stringify(tiles, null, 2));
  const { generateProductReviews } = (await vite.ssrLoadModule('/src/data/reviews.ts')) as { generateProductReviews: (p: unknown) => Record<string, unknown>[] };
  const reviews = PRODUCTS.flatMap((p) =>
    generateProductReviews(p).map((r) => ({ productLegacyId: p.id, author: r.author, rating: r.rating, title: r.title, body: r.body, fit: r.fit ?? null, size: r.size ?? null, createdAt: r.createdAt })),
  );
  fs.writeFileSync(path.join(out, 'reviews.json'), JSON.stringify(reviews, null, 2));
  console.log(`Exported ${products.length} products, ${tiles.length} category tiles, ${reviews.length} reviews.`);
} finally {
  await vite.close();
}
