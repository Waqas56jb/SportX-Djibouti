import type { Customer, CustomerActivity, CustomerGroup, CustomerInput, CustomerStatus } from '@/types';
import { appConfig } from '@/constants/config';
import { formatMoney } from '@/utils/format';
import { api, ApiError } from './http';
import { audit, db, delay, matches, NotFoundError } from './mock/db';

export interface CustomerFilters {
  search?: string;
  status?: CustomerStatus | '';
  group?: CustomerGroup | '';
  city?: string;
}

export const CUSTOMER_GROUPS: { id: CustomerGroup; label: string; description: string; rule: string }[] = [
  { id: 'all', label: 'All Customers', description: 'Every registered customer.', rule: 'All accounts' },
  { id: 'new', label: 'New Customers', description: 'Joined in the last 30 days.', rule: 'Joined ≤ 30 days ago' },
  { id: 'returning', label: 'Returning', description: 'Placed two or more orders.', rule: 'Orders ≥ 2' },
  { id: 'high_value', label: 'High Value', description: 'Lifetime spend of DJF 80,000 or more.', rule: 'Total spent ≥ DJF 80,000' },
  { id: 'inactive', label: 'Inactive', description: 'No activity in the last 60 days.', rule: 'No order in 60 days' },
];

function find(id: string): Customer {
  const c = db.customers.find((x) => x.id === id);
  if (!c) throw new NotFoundError('Customer');
  return c;
}

export const customerService = {
  /** GET /customers */
  async getCustomers(filters: CustomerFilters = {}): Promise<Customer[]> {
    if (!appConfig.useMocks) return api.get<Customer[]>('/customers', { ...filters });
    const list = db.customers
      .filter((c) => matches([`${c.firstName} ${c.lastName}`, c.email, c.phone, c.phone.replace(/\s/g, '')], filters.search))
      .filter((c) => !filters.status || c.status === filters.status)
      .filter((c) => !filters.group || c.groups.includes(filters.group))
      .filter((c) => !filters.city || c.addresses.some((a) => a.city === filters.city))
      .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
    return delay(list);
  },

  /** GET /customers/:id */
  async getCustomer(id: string): Promise<Customer> {
    if (!appConfig.useMocks) return api.get<Customer>(`/customers/${id}`);
    return delay(find(id));
  },

  /** PATCH /customers/:id */
  async updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
    if (!appConfig.useMocks) return api.patch<Customer>(`/customers/${id}`, input);
    const c = find(id);
    if (db.customers.some((x) => x.id !== id && x.email.toLowerCase() === input.email.toLowerCase())) throw new ApiError('Another customer already uses this email.', 409);
    Object.assign(c, input);
    audit('Customer updated', 'Customers', `${c.firstName} ${c.lastName}`, `/customers/${id}`);
    return delay(c);
  },

  /** PATCH /customers/:id/status */
  async setStatus(id: string, status: CustomerStatus): Promise<Customer> {
    if (!appConfig.useMocks) return api.patch<Customer>(`/customers/${id}/status`, { status });
    const c = find(id);
    c.status = status;
    const label = status === 'active' ? 'Customer reactivated' : status === 'blocked' ? 'Customer blocked' : 'Customer deactivated';
    audit(label, 'Customers', `${c.firstName} ${c.lastName}`, `/customers/${id}`);
    return delay(c);
  },

  /** GET /customers/groups — group counts; rules will live server-side. */
  async getGroupSummary(): Promise<{ id: CustomerGroup; count: number; revenue: number }[]> {
    if (!appConfig.useMocks) return api.get('/customers/groups');
    return delay(
      CUSTOMER_GROUPS.map((g) => {
        const members = db.customers.filter((c) => c.groups.includes(g.id));
        return { id: g.id, count: members.length, revenue: members.reduce((s, c) => s + c.totalSpent, 0) };
      }),
    );
  },

  /** GET /customers/:id/activity */
  async getActivity(id: string): Promise<CustomerActivity[]> {
    if (!appConfig.useMocks) return api.get<CustomerActivity[]>(`/customers/${id}/activity`);
    const c = find(id);
    const ev: CustomerActivity[] = [
      { id: `${id}_join`, customerId: id, type: 'account_created', title: 'Account created', createdAt: c.joinedAt },
    ];
    for (const o of db.orders.filter((x) => x.customerId === id))
      ev.push({ id: `${id}_${o.id}`, customerId: id, type: 'order_placed', title: `Placed order ${o.number}`, description: `${o.itemsCount} item(s) · ${formatMoney(o.total)}`, link: `/orders/${o.id}`, createdAt: o.createdAt });
    for (const r of db.reviews.filter((x) => x.customerId === id))
      ev.push({ id: `${id}_${r.id}`, customerId: id, type: 'review_posted', title: `Reviewed ${r.productName}`, description: `${r.rating}★ — “${r.title}”`, link: '/reviews', createdAt: r.createdAt });
    for (const t of db.tickets.filter((x) => x.customerId === id))
      ev.push({ id: `${id}_${t.id}`, customerId: id, type: 'ticket_opened', title: `Opened ticket ${t.number}`, description: t.subject, link: `/support/${t.id}`, createdAt: t.createdAt });
    for (const a of db.activityLogs.filter((x) => x.recordLink === `/customers/${id}`))
      ev.push({ id: `${id}_${a.id}`, customerId: id, type: 'status_changed', title: a.action, description: `by ${a.adminName}`, createdAt: a.createdAt });
    return delay(ev.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },
};
