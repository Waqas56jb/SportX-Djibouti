import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/database.js';
import { asyncHandler } from '../../utils/http.js';
import { ok } from '../../utils/apiResponse.js';
import { hasPermission } from '../../middleware/role.middleware.js';
import { validate, query as q } from '../../middleware/validation.middleware.js';

/**
 * /api/v1/admin/search?q= — global admin search. Any staff member may call it; each group is only
 * searched when the caller holds that module's view permission. Max 5 results per group.
 */
export const searchRouter = Router();

const searchQuery = z.object({
  q: z.string().trim().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(5).default(5),
});

interface Result {
  id: string;
  group: 'orders' | 'products' | 'customers' | 'tickets' | 'categories';
  title: string;
  subtitle: string;
  meta?: string;
  to: string;
  image?: string | null;
}

const money = (n: number) => `DJF ${Number(n).toLocaleString('en-US')}`;
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

searchRouter.get(
  '/',
  validate({ query: searchQuery }),
  asyncHandler(async (req, res) => {
    const { q: raw, limit } = q<z.infer<typeof searchQuery>>(req);
    if (raw.length < 2) return ok(res, []);
    const like = `%${raw.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    // Compact form for order/ticket numbers and phones ("spx2026 12" → "SPX202612").
    const compact = raw.replace(/[\s#-]/g, '');
    const compactLike = compact.length >= 2 ? `%${compact.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : like;
    const out: Result[] = [];
    const can = (p: string) => hasPermission(req.auth, p);

    if (can('orders:view')) {
      const rows = await query<{ id: string; order_number: string; name: string; grand_total: number; status: string }>(
        `select id, order_number, customer_first_name || ' ' || customer_last_name as name, grand_total, status from public.orders
          where deleted_at is null and (order_number ilike $1 or replace(order_number, '-', '') ilike $2 or email ilike $1
                or regexp_replace(phone, '[^0-9+]', '', 'g') ilike $2 or (customer_first_name || ' ' || customer_last_name) ilike $1)
          order by placed_at desc limit $3`,
        [like, compactLike, limit],
      );
      out.push(...rows.map<Result>((o) => ({ id: o.id, group: 'orders', title: `Order #${o.order_number}`, subtitle: o.name, meta: `${money(o.grand_total)} · ${label(o.status)}`, to: `/orders/${o.id}` })));
    }

    if (can('products:view')) {
      const rows = await query<{ id: string; name: string; sku: string; price: number; brand: string; image: string | null }>(
        `select p.id, p.name, p.sku, p.price, b.name as brand,
                (select im.url from public.product_images im where im.product_id = p.id order by (im.role = 'MAIN') desc, im.position limit 1) as image
           from public.products p join public.brands b on b.id = p.brand_id
          where p.deleted_at is null and (p.name ilike $1 or p.sku ilike $1 or b.name ilike $1
                or exists (select 1 from public.product_variants v where v.product_id = p.id and v.deleted_at is null and v.sku ilike $1))
          order by (p.name ilike $1) desc, p.updated_at desc limit $2`,
        [like, limit],
      );
      out.push(...rows.map<Result>((p) => ({ id: p.id, group: 'products', title: p.name, subtitle: `${p.sku} · ${p.brand}`, meta: money(p.price), to: `/products/${p.id}`, image: p.image })));
    }

    if (can('customers:view')) {
      const rows = await query<{ id: string; name: string; email: string; orders: number }>(
        `select u.id, u.first_name || ' ' || u.last_name as name, u.email,
                (select count(*)::int from public.orders o where o.user_id = u.id and o.deleted_at is null) as orders
           from public.users u
          where u.deleted_at is null
            and exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = u.id and r.slug = 'CUSTOMER')
            and ((u.first_name || ' ' || u.last_name) ilike $1 or u.email ilike $1 or regexp_replace(coalesce(u.phone, ''), '[^0-9+]', '', 'g') ilike $2)
          order by u.created_at desc limit $3`,
        [like, compactLike, limit],
      );
      out.push(...rows.map<Result>((c) => ({ id: c.id, group: 'customers', title: c.name, subtitle: c.email, meta: `${c.orders} order${c.orders === 1 ? '' : 's'}`, to: `/customers/${c.id}` })));
    }

    if (can('support:view')) {
      const rows = await query<{ id: string; ticket_number: string; subject: string; name: string; status: string }>(
        `select t.id, t.ticket_number, t.subject, u.first_name || ' ' || u.last_name as name, t.status
           from public.support_tickets t join public.users u on u.id = t.user_id
           left join public.orders o on o.id = t.order_id
          where t.ticket_number ilike $1 or replace(t.ticket_number, '-', '') ilike $2 or t.subject ilike $1
             or (u.first_name || ' ' || u.last_name) ilike $1 or u.email ilike $1 or coalesce(o.order_number, '') ilike $1
          order by t.updated_at desc limit $3`,
        [like, compactLike, limit],
      );
      out.push(...rows.map<Result>((t) => ({ id: t.id, group: 'tickets', title: `${t.ticket_number} · ${t.subject}`, subtitle: t.name, meta: label(t.status), to: `/support/${t.id}` })));
    }

    if (can('categories:view')) {
      const rows = await query<{ id: string; name: string; slug: string; products: number }>(
        `select c.id, c.name, c.slug, (select count(*)::int from public.products p where p.category_id = c.id and p.deleted_at is null) as products
           from public.categories c where c.name ilike $1 or c.slug ilike $1 order by c.sort_order, c.name limit $2`,
        [like, limit],
      );
      out.push(...rows.map<Result>((c) => ({ id: c.id, group: 'categories', title: c.name, subtitle: `${c.products} product${c.products === 1 ? '' : 's'}`, to: `/products?category=${c.id}` })));
    }

    return ok(res, out);
  }),
);
