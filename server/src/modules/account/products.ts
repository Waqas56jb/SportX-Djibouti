import { pool, queryOne, type Db } from '../../config/database.js';
import { notFound } from '../../utils/errors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolves a storefront product reference (UUID or slug) to a published, non-deleted product; 404 otherwise. */
export async function resolvePublishedProduct(idOrSlug: string, db: Db = pool): Promise<{ id: string; name: string; slug: string }> {
  const ref = String(idOrSlug ?? '').trim();
  if (!ref || ref.length > 200) throw notFound('Product');
  const byId = UUID_RE.test(ref);
  const row = await queryOne<{ id: string; name: string; slug: string }>(
    `select id, name, slug from public.products
      where ${byId ? 'id = $1::uuid' : 'slug = $1'} and status = 'PUBLISHED' and deleted_at is null`,
    [byId ? ref.toLowerCase() : ref.toLowerCase()],
    db,
  );
  if (!row) throw notFound('Product');
  return row;
}
