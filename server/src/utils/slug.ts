import type { Db } from '../config/database.js';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/**
 * Returns `base` or `base-2`, `base-3`… so the slug is unique in `table`.
 * `table` must be a trusted identifier (never user input).
 */
export async function uniqueSlug(db: Db, table: 'products' | 'categories' | 'brands', base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || 'item';
  const res = await db.query<{ slug: string }>(
    `select slug from public.${table} where (slug = $1 or slug like $1 || '-%') and ($2::uuid is null or id <> $2::uuid)`,
    [root, excludeId ?? null],
  );
  const taken = new Set(res.rows.map((r) => r.slug));
  if (!taken.has(root)) return root;
  for (let i = 2; i < 10_000; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
  return `${root}-${Date.now()}`;
}
