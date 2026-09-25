import { appConfig } from '@/constants/config';
import { ORDER_STATUS, TICKET_STATUS } from '@/constants/status';
import { formatMoney } from '@/utils/format';
import { api } from './http';
import { db, delay } from './mock/db';

export type SearchGroup = 'products' | 'orders' | 'customers' | 'tickets' | 'categories';

export interface SearchResult {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle: string;
  meta?: string;
  to: string;
  image?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s#-]/g, '');

export const searchService = {
  /** GET /search?q= — grouped, capped results across modules. */
  async search(query: string, limitPerGroup = 5): Promise<SearchResult[]> {
    if (!appConfig.useMocks) return api.get<SearchResult[]>('/search', { q: query, limit: limitPerGroup });
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const nq = norm(q);
    const hit = (...fields: (string | undefined)[]) => fields.some((f) => f && (f.toLowerCase().includes(q) || norm(f).includes(nq)));

    const orders = db.orders
      .filter((o) => hit(o.number, o.customerName, o.customerEmail, o.customerPhone))
      .slice(0, limitPerGroup)
      .map<SearchResult>((o) => ({ id: o.id, group: 'orders', title: `Order #${o.number}`, subtitle: o.customerName, meta: `${formatMoney(o.total)} · ${ORDER_STATUS[o.status].label}`, to: `/orders/${o.id}` }));

    const products = db.products
      .filter((p) => hit(p.name, p.sku, db.brands.find((b) => b.id === p.brandId)?.name, ...p.variants.map((v) => v.sku)))
      .slice(0, limitPerGroup)
      .map<SearchResult>((p) => ({ id: p.id, group: 'products', title: p.name, subtitle: p.sku, meta: formatMoney(p.price), to: `/products/${p.id}`, image: p.images[0]?.url }));

    const customers = db.customers
      .filter((c) => hit(`${c.firstName} ${c.lastName}`, c.email, c.phone))
      .slice(0, limitPerGroup)
      .map<SearchResult>((c) => ({ id: c.id, group: 'customers', title: `${c.firstName} ${c.lastName}`, subtitle: c.email, meta: `${c.ordersCount} orders`, to: `/customers/${c.id}` }));

    const tickets = db.tickets
      .filter((t) => hit(t.number, t.subject, t.customerName, t.orderNumber))
      .slice(0, limitPerGroup)
      .map<SearchResult>((t) => ({ id: t.id, group: 'tickets', title: `${t.number} · ${t.subject}`, subtitle: t.customerName, meta: TICKET_STATUS[t.status].label, to: `/support/${t.id}` }));

    const categories = db.categories
      .filter((c) => hit(c.name, c.slug))
      .slice(0, limitPerGroup)
      .map<SearchResult>((c) => ({ id: c.id, group: 'categories', title: c.name, subtitle: `${c.productCount} products`, to: `/products?category=${c.id}` }));

    return delay([...orders, ...products, ...customers, ...tickets, ...categories], 180);
  },
};
