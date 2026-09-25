import type { Request } from 'express';
import { query, queryOne, withTransaction } from '../../config/database.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { slugify, uniqueSlug } from '../../utils/slug.js';
import { audit } from '../../services/audit.service.js';
import { storageService } from '../../services/storage/storage.service.js';
import { toAdminBrand, toPublicBrand, type BrandRow } from './catalog.mapper.js';

const SELECT = (publishedOnly: boolean) => `select b.*, coalesce(n.cnt, 0)::int as product_count
  from public.brands b
  left join (select brand_id, count(*) as cnt from public.products
              where deleted_at is null ${publishedOnly ? `and status = 'PUBLISHED'` : ''} group by brand_id) n on n.brand_id = b.id`;

export const publicBrandsService = {
  async list() {
    const rows = await query<BrandRow>(`${SELECT(true)} where b.is_active order by b.name`);
    return rows.map(toPublicBrand);
  },
  async bySlug(slug: string) {
    const row = await queryOne<BrandRow>(`${SELECT(true)} where b.is_active and b.slug = $1`, [slug.toLowerCase()]);
    if (!row) throw notFound('Brand');
    return toPublicBrand(row);
  },
};

export interface BrandInput {
  name?: string;
  slug?: string;
  description?: string;
  logoUrl?: string | null;
  website?: string | null;
  isActive?: boolean;
}

async function get(id: string) {
  const row = await queryOne<BrandRow>(`${SELECT(false)} where b.id = $1`, [id]);
  if (!row) throw notFound('Brand');
  return toAdminBrand(row);
}

async function assertUnique(name: string | undefined, slug: string | undefined, excludeId?: string) {
  if (slug) {
    const t = await queryOne(`select 1 from public.brands where slug = $1 and ($2::uuid is null or id <> $2::uuid)`, [slug, excludeId ?? null]);
    if (t) throw conflict('A brand with this slug already exists.', { field: 'slug', value: slug });
  }
  if (name) {
    const t = await queryOne(`select 1 from public.brands where lower(name) = lower($1) and ($2::uuid is null or id <> $2::uuid)`, [name, excludeId ?? null]);
    if (t) throw conflict('A brand with this name already exists.', { field: 'name', value: name });
  }
}

export const adminBrandsService = {
  async list(search?: string) {
    const rows = await query<BrandRow>(
      `${SELECT(false)} where ($1::text is null or b.name ilike '%' || $1 || '%' or b.slug ilike '%' || $1 || '%') order by b.name`,
      [search || null],
    );
    return rows.map(toAdminBrand);
  },
  get,

  async create(req: Request, input: BrandInput & { name: string }) {
    const explicit = input.slug ? slugify(input.slug) : undefined;
    if (input.slug !== undefined && !explicit) throw badRequest('Invalid slug.', { field: 'slug' });
    await assertUnique(input.name, explicit);
    const id = await withTransaction(async (tx) => {
      const slug = explicit ?? (await uniqueSlug(tx, 'brands', input.name));
      const row = await queryOne<{ id: string }>(
        `insert into public.brands (name, slug, description, logo_url, website, is_active) values ($1, $2, $3, $4, $5, $6) returning id`,
        [input.name, slug, input.description ?? '', input.logoUrl ?? null, input.website || null, input.isActive ?? true],
        tx,
      );
      await audit(req, { action: 'Brand created', entityType: 'brand', entityId: row!.id, metadata: { name: input.name, slug } }, tx);
      return row!.id;
    });
    return get(id);
  },

  async update(req: Request, id: string, input: BrandInput) {
    const cur = await queryOne<BrandRow>(`select * from public.brands where id = $1`, [id]);
    if (!cur) throw notFound('Brand');
    const slug = input.slug !== undefined ? slugify(input.slug) : undefined;
    if (input.slug !== undefined && !slug) throw badRequest('Invalid slug.', { field: 'slug' });
    await assertUnique(input.name, slug, id);
    const sets: string[] = [];
    const params: unknown[] = [id];
    const set = (col: string, v: unknown) => {
      params.push(v);
      sets.push(`${col} = $${params.length}`);
    };
    if (input.name !== undefined) set('name', input.name);
    if (slug !== undefined) set('slug', slug);
    if (input.description !== undefined) set('description', input.description);
    const logoChanged = input.logoUrl !== undefined && input.logoUrl !== cur.logo_url;
    if (logoChanged) {
      set('logo_url', input.logoUrl);
      set('logo_path', null);
    }
    if (input.website !== undefined) set('website', input.website || null);
    if (input.isActive !== undefined) set('is_active', input.isActive);
    if (sets.length) {
      await withTransaction(async (tx) => {
        await query(`update public.brands set ${sets.join(', ')} where id = $1`, params, tx);
        await audit(req, { action: 'Brand updated', entityType: 'brand', entityId: id, metadata: { fields: Object.keys(input) } }, tx);
      });
      if (logoChanged) await storageService.remove(cur.logo_path);
    }
    return get(id);
  },

  async setStatus(req: Request, id: string, isActive: boolean) {
    const row = await queryOne(`update public.brands set is_active = $2 where id = $1 returning id`, [id, isActive]);
    if (!row) throw notFound('Brand');
    await audit(req, { action: isActive ? 'Brand enabled' : 'Brand disabled', entityType: 'brand', entityId: id });
    return get(id);
  },

  async remove(req: Request, id: string) {
    const cur = await queryOne<BrandRow>(`select b.*, (select count(*) from public.products p where p.brand_id = b.id)::int as product_count from public.brands b where b.id = $1`, [id]);
    if (!cur) throw notFound('Brand');
    if (cur.product_count > 0) throw conflict('This brand still has products. Reassign or delete them first.', { reason: 'has_products', products: cur.product_count });
    await withTransaction(async (tx) => {
      await query(`delete from public.brands where id = $1`, [id], tx);
      await audit(req, { action: 'Brand deleted', entityType: 'brand', entityId: id, metadata: { name: cur.name } }, tx);
    });
    await storageService.remove(cur.logo_path);
  },

  async uploadLogo(req: Request, id: string, file: Express.Multer.File) {
    const cur = await queryOne<BrandRow>(`select * from public.brands where id = $1`, [id]);
    if (!cur) throw notFound('Brand');
    const stored = await storageService.putImage('brands', id, file);
    try {
      await withTransaction(async (tx) => {
        await query(`update public.brands set logo_url = $2, logo_path = $3 where id = $1`, [id, stored.url, stored.path], tx);
        await audit(req, { action: 'Brand logo uploaded', entityType: 'brand', entityId: id, metadata: { path: stored.path } }, tx);
      });
    } catch (err) {
      await storageService.remove(stored.path);
      throw err;
    }
    await storageService.remove(cur.logo_path);
    return get(id);
  },
};
