import type { Request } from 'express';
import { query, queryOne, withTransaction } from '../../config/database.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { slugify, uniqueSlug } from '../../utils/slug.js';
import { audit } from '../../services/audit.service.js';
import { storageService } from '../../services/storage/storage.service.js';
import { toAdminCategory, toPublicCategory, type CategoryRow } from './catalog.mapper.js';

type PublicCategory = ReturnType<typeof toPublicCategory> & { children: PublicCategory[] };

/** Loads categories with the number of products directly in each (published-only for the storefront). */
async function loadWithCounts(publicOnly: boolean): Promise<CategoryRow[]> {
  return query<CategoryRow>(
    `select c.*, coalesce(n.cnt, 0)::int as product_count
       from public.categories c
       left join (select category_id, count(*) as cnt from public.products
                   where deleted_at is null ${publicOnly ? `and status = 'PUBLISHED'` : ''} group by category_id) n on n.category_id = c.id
      ${publicOnly ? 'where c.is_active' : ''}
      order by c.sort_order, c.name`,
  );
}

/** Builds the tree; a node's productCount includes all of its descendants. Orphans of inactive parents are dropped. */
function buildTree(rows: CategoryRow[]) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const children = new Map<string | null, CategoryRow[]>();
  for (const r of rows) {
    const key = r.parent_id && byId.has(r.parent_id) ? r.parent_id : r.parent_id ? '__orphan__' : null;
    if (!children.has(key)) children.set(key, []);
    children.get(key)!.push(r);
  }
  const build = (r: CategoryRow): PublicCategory => {
    const kids = (children.get(r.id) ?? []).map(build);
    const total = (r.product_count ?? 0) + kids.reduce((s, k) => s + k.productCount, 0);
    return { ...toPublicCategory(r, total), children: kids };
  };
  return (children.get(null) ?? []).map(build);
}

function flattenTree(nodes: PublicCategory[], out: PublicCategory[] = []) {
  for (const n of nodes) {
    out.push(n);
    flattenTree(n.children, out);
  }
  return out;
}

export const publicCategoriesService = {
  async tree() {
    return buildTree(await loadWithCounts(true));
  },

  async bySlug(slug: string) {
    const rows = await loadWithCounts(true);
    const tree = buildTree(rows);
    const node = flattenTree(tree).find((n) => n.slug === slug.toLowerCase());
    if (!node) throw notFound('Category');
    const byId = new Map(rows.map((r) => [r.id, r]));
    const breadcrumb: { id: string; name: string; slug: string }[] = [];
    let cur = byId.get(node.id);
    while (cur) {
      breadcrumb.unshift({ id: cur.id, name: cur.name, slug: cur.slug });
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return { ...node, breadcrumb };
  },
};

// ───────────────────────── Admin ─────────────────────────

export interface CategoryInput {
  name?: string;
  slug?: string;
  description?: string;
  imageUrl?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

/** Flat admin list in tree order, with depth and direct + total product counts. */
async function adminList() {
  const rows = await loadWithCounts(false);
  const byParent = new Map<string | null, CategoryRow[]>();
  const ids = new Set(rows.map((r) => r.id));
  for (const r of rows) {
    const key = r.parent_id && ids.has(r.parent_id) ? r.parent_id : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(r);
  }
  const out: ReturnType<typeof toAdminCategory>[] = [];
  const total = (id: string): number => (byParent.get(id) ?? []).reduce((s, c) => s + (c.product_count ?? 0) + total(c.id), 0);
  const walk = (parent: string | null, depth: number, seen: Set<string>) => {
    for (const r of byParent.get(parent) ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(
        toAdminCategory(r, {
          depth,
          productCount: r.product_count ?? 0,
          totalProductCount: (r.product_count ?? 0) + total(r.id),
          childrenCount: (byParent.get(r.id) ?? []).length,
        }),
      );
      walk(r.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());
  return out;
}

async function adminGet(id: string) {
  const list = await adminList();
  const c = list.find((x) => x.id === id);
  if (!c) throw notFound('Category');
  return c;
}

async function assertSlugFree(slug: string, excludeId?: string) {
  const taken = await queryOne(`select 1 from public.categories where slug = $1 and ($2::uuid is null or id <> $2::uuid)`, [slug, excludeId ?? null]);
  if (taken) throw conflict('A category with this slug already exists.', { field: 'slug', value: slug });
}

async function assertParent(parentId: string, selfId?: string) {
  const parent = await queryOne(`select id from public.categories where id = $1`, [parentId]);
  if (!parent) throw badRequest('Parent category not found.', { field: 'parentId' });
  if (!selfId) return;
  if (parentId === selfId) throw badRequest('A category cannot be its own parent.', { field: 'parentId' });
  // Walk up from the new parent; reaching `selfId` means the move would create a cycle.
  const cycle = await queryOne(
    `with recursive up as (
       select id, parent_id, 1 as depth from public.categories where id = $1
       union all
       select c.id, c.parent_id, up.depth + 1 from public.categories c join up on c.id = up.parent_id where up.depth < 50
     ) select 1 from up where id = $2 limit 1`,
    [parentId, selfId],
  );
  if (cycle) throw badRequest('A category cannot be moved under one of its own sub-categories.', { field: 'parentId' });
}

export const adminCategoriesService = {
  list: adminList,
  get: adminGet,

  async create(req: Request, input: CategoryInput & { name: string }) {
    let slug = '';
    if (input.slug) {
      slug = slugify(input.slug);
      if (!slug) throw badRequest('Invalid slug.', { field: 'slug' });
      await assertSlugFree(slug);
    }
    if (input.parentId) await assertParent(input.parentId);
    const id = await withTransaction(async (tx) => {
      if (!input.slug) slug = await uniqueSlug(tx, 'categories', input.name);
      const sortOrder =
        input.sortOrder ??
        (await queryOne<{ n: number }>(`select coalesce(max(sort_order) + 1, 0)::int as n from public.categories where parent_id is not distinct from $1::uuid`, [input.parentId ?? null], tx))!.n;
      const row = await queryOne<{ id: string }>(
        `insert into public.categories (parent_id, name, slug, description, image_url, is_active, sort_order, seo_title, seo_description)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
        [input.parentId ?? null, input.name, slug, input.description ?? '', input.imageUrl ?? null, input.isActive ?? true, sortOrder, input.seoTitle ?? null, input.seoDescription ?? null],
        tx,
      );
      await audit(req, { action: 'Category created', entityType: 'category', entityId: row!.id, metadata: { name: input.name, slug } }, tx);
      return row!.id;
    });
    return adminGet(id);
  },

  async update(req: Request, id: string, input: CategoryInput) {
    const cur = await queryOne<CategoryRow>(`select * from public.categories where id = $1`, [id]);
    if (!cur) throw notFound('Category');
    const sets: string[] = [];
    const params: unknown[] = [id];
    const set = (col: string, v: unknown) => {
      params.push(v);
      sets.push(`${col} = $${params.length}`);
    };
    if (input.slug !== undefined) {
      const slug = slugify(input.slug);
      if (!slug) throw badRequest('Invalid slug.', { field: 'slug' });
      if (slug !== cur.slug) {
        await assertSlugFree(slug, id);
        set('slug', slug);
      }
    }
    if (input.parentId !== undefined && input.parentId !== cur.parent_id) {
      if (input.parentId) await assertParent(input.parentId, id);
      set('parent_id', input.parentId);
    }
    if (input.name !== undefined) set('name', input.name);
    if (input.description !== undefined) set('description', input.description);
    if (input.imageUrl !== undefined && input.imageUrl !== cur.image_url) {
      set('image_url', input.imageUrl);
      set('image_path', null);
    }
    if (input.isActive !== undefined) set('is_active', input.isActive);
    if (input.sortOrder !== undefined) set('sort_order', input.sortOrder);
    if (input.seoTitle !== undefined) set('seo_title', input.seoTitle);
    if (input.seoDescription !== undefined) set('seo_description', input.seoDescription);
    if (sets.length) {
      await withTransaction(async (tx) => {
        await query(`update public.categories set ${sets.join(', ')} where id = $1`, params, tx);
        await audit(req, { action: 'Category updated', entityType: 'category', entityId: id, metadata: { fields: Object.keys(input) } }, tx);
      });
      if (input.imageUrl !== undefined && input.imageUrl !== cur.image_url) await storageService.remove(cur.image_path);
    }
    return adminGet(id);
  },

  async setStatus(req: Request, id: string, isActive: boolean) {
    const row = await queryOne(`update public.categories set is_active = $2 where id = $1 returning id`, [id, isActive]);
    if (!row) throw notFound('Category');
    await audit(req, { action: isActive ? 'Category enabled' : 'Category disabled', entityType: 'category', entityId: id });
    return adminGet(id);
  },

  async remove(req: Request, id: string) {
    const cur = await queryOne<CategoryRow>(`select * from public.categories where id = $1`, [id]);
    if (!cur) throw notFound('Category');
    const usage = await queryOne<{ children: number; products: number }>(
      `select (select count(*) from public.categories where parent_id = $1)::int as children,
              (select count(*) from public.products where category_id = $1)::int as products`,
      [id],
    );
    if (usage!.children > 0) throw conflict('Move or delete the sub-categories first.', { reason: 'has_children', children: usage!.children });
    if (usage!.products > 0) throw conflict('This category still contains products. Reassign them first.', { reason: 'has_products', products: usage!.products });
    await withTransaction(async (tx) => {
      await query(`delete from public.categories where id = $1`, [id], tx);
      await audit(req, { action: 'Category deleted', entityType: 'category', entityId: id, metadata: { name: cur.name, slug: cur.slug } }, tx);
    });
    await storageService.remove(cur.image_path);
  },

  /** Sets sort_order to the given order. All ids must be siblings (same parent). */
  async reorder(req: Request, ids: string[]) {
    const rows = await query<{ id: string; parent_id: string | null }>(`select id, parent_id from public.categories where id = any($1::uuid[])`, [ids]);
    if (rows.length !== new Set(ids).size) throw notFound('Category');
    if (new Set(rows.map((r) => r.parent_id ?? 'root')).size > 1) throw badRequest('Only categories with the same parent can be reordered together.');
    await withTransaction(async (tx) => {
      await query(
        `update public.categories c set sort_order = (o.pos - 1)::int from unnest($1::uuid[]) with ordinality as o(id, pos) where c.id = o.id`,
        [ids],
        tx,
      );
      await audit(req, { action: 'Categories reordered', entityType: 'category', metadata: { ids } }, tx);
    });
  },

  async uploadImage(req: Request, id: string, file: Express.Multer.File) {
    const cur = await queryOne<CategoryRow>(`select * from public.categories where id = $1`, [id]);
    if (!cur) throw notFound('Category');
    const stored = await storageService.putImage('categories', id, file);
    try {
      await withTransaction(async (tx) => {
        await query(`update public.categories set image_url = $2, image_path = $3 where id = $1`, [id, stored.url, stored.path], tx);
        await audit(req, { action: 'Category image uploaded', entityType: 'category', entityId: id, metadata: { path: stored.path } }, tx);
      });
    } catch (err) {
      await storageService.remove(stored.path);
      throw err;
    }
    await storageService.remove(cur.image_path);
    return adminGet(id);
  },
};
