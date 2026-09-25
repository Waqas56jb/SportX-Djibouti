import type { AdminUser, Customer, CustomerAddress, Role } from '@/types';
import { ALL_PERMISSIONS, grant } from '@/constants/permissions';
import { createRng, daysAgo } from './seed';

const rng = createRng(4242);

// ─── Roles ──────────────────────────────────────────────────────────────────
export const roles: Role[] = [
  {
    id: 'role_super_admin',
    slug: 'super_admin',
    name: 'Super Admin',
    description: 'Full access to every module, including payments, admin users and roles.',
    permissions: [...ALL_PERMISSIONS],
    isSystem: true,
    userCount: 0,
    updatedAt: daysAgo(90),
  },
  {
    id: 'role_store_manager',
    slug: 'store_manager',
    name: 'Store Manager',
    description: 'Runs day-to-day operations across catalogue, orders, customers and marketing. No access to admin users or payment credentials.',
    permissions: [
      ...grant(['dashboard', 'products', 'categories', 'inventory', 'orders', 'customers', 'reviews', 'discounts', 'reports', 'support'], 'all'),
      'settings:view',
    ],
    isSystem: true,
    userCount: 0,
    updatedAt: daysAgo(60),
  },
  {
    id: 'role_product_manager',
    slug: 'product_manager',
    name: 'Product Manager',
    description: 'Manages the catalogue, inventory and product reviews.',
    permissions: [
      'dashboard:view',
      ...grant(['products', 'categories', 'inventory'], 'all'),
      ...grant(['reviews'], ['view', 'approve', 'edit']),
      ...grant(['reports'], ['view']),
    ],
    isSystem: true,
    userCount: 0,
    updatedAt: daysAgo(45),
  },
  {
    id: 'role_order_manager',
    slug: 'order_manager',
    name: 'Order Manager',
    description: 'Handles fulfilment, shipping, refunds and customer order enquiries.',
    permissions: [
      'dashboard:view',
      ...grant(['orders'], 'all'),
      ...grant(['customers'], ['view']),
      ...grant(['inventory', 'products'], ['view']),
      ...grant(['support'], ['view', 'edit']),
      ...grant(['reports'], ['view']),
    ],
    isSystem: true,
    userCount: 0,
    updatedAt: daysAgo(45),
  },
  {
    id: 'role_support_manager',
    slug: 'support_manager',
    name: 'Support Manager',
    description: 'Owns the support inbox and customer accounts.',
    permissions: [
      'dashboard:view',
      ...grant(['support'], 'all'),
      ...grant(['customers'], ['view', 'edit']),
      ...grant(['orders'], ['view']),
      ...grant(['reviews'], ['view', 'approve']),
    ],
    isSystem: true,
    userCount: 0,
    updatedAt: daysAgo(30),
  },
];

// ─── Admin users ────────────────────────────────────────────────────────────
type AdminDef = [name: string, email: string, roleId: string, status: AdminUser['status'], lastLoginDays: number | null];
const ADMIN_DEFS: AdminDef[] = [
  ['Youssouf Ahmed', 'admin@sportx.demo', 'role_super_admin', 'active', 0],
  ['Hodan Abdillahi', 'store.manager@sportx.demo', 'role_store_manager', 'active', 0],
  ['Ibrahim Daher', 'products@sportx.demo', 'role_product_manager', 'active', 1],
  ['Kadra Youssouf', 'orders@sportx.demo', 'role_order_manager', 'active', 0],
  ['Nasra Elmi', 'support@sportx.demo', 'role_support_manager', 'active', 0],
  ['Omar Farah', 'omar.farah@sportx.demo', 'role_order_manager', 'active', 3],
  ['Samira Ismael', 'samira.ismael@sportx.demo', 'role_support_manager', 'invited', null],
  ['Ali Dirieh', 'ali.dirieh@sportx.demo', 'role_product_manager', 'deactivated', 64],
];

export const adminUsers: AdminUser[] = ADMIN_DEFS.map(([name, email, roleId, status, last], i) => ({
  id: `adm_${i + 1}`,
  name,
  email,
  phone: `+253 77 ${String(10 + i * 7).padStart(2, '0')} ${String(20 + i * 3).padStart(2, '0')} ${String(40 + i).padStart(2, '0')}`,
  roleId,
  roleName: roles.find((r) => r.id === roleId)!.name,
  status,
  lastLoginAt: last === null ? undefined : daysAgo(last, 8 + (i % 4), 12 * i % 60),
  createdAt: daysAgo(300 - i * 20),
}));

for (const r of roles) r.userCount = adminUsers.filter((u) => u.roleId === r.id).length;

/** Demo credentials shown on the login screen. All share this password in mock mode. */
export const DEMO_PASSWORD = 'sportx2026';

// ─── Customers ──────────────────────────────────────────────────────────────
const CUSTOMER_NAMES: [string, string][] = [
  ['Ahmed', 'Hassan'], ['Fatouma', 'Ali'], ['Mohamed', 'Houmed'], ['Aicha', 'Moussa'], ['Ismail', 'Guedi'],
  ['Hibo', 'Mahamoud'], ['Abdourahman', 'Idriss'], ['Deka', 'Robleh'], ['Houssein', 'Djama'], ['Amina', 'Aden'],
  ['Said', 'Bouh'], ['Yacin', 'Waberi'], ['Moustapha', 'Abdi'], ['Zahra', 'Osman'], ['Kamil', 'Ahmed'],
  ['Safia', 'Mohamed'], ['Idriss', 'Barkat'], ['Mouna', 'Ibrahim'], ['Abdillahi', 'Miguil'], ['Filsan', 'Warsama'],
  ['John', 'Mercer'], ['Marie', 'Laurent'], ['Roda', 'Hassan'], ['Mahdi', 'Aouled'], ['Neima', 'Doualeh'],
  ['Farah', 'Guelleh'], ['Hamda', 'Youssouf'], ['Elmi', 'Abdi'], ['Luc', 'Martin'], ['Ayan', 'Farah'],
  ['Bilan', 'Said'], ['Abdoulkader', 'Omar'],
];

const DISTRICTS = ['Plateau du Serpent', 'Héron', 'Haramous', 'Balbala', 'Salines Ouest', 'Quartier 7', 'Gabode', 'Cité Hodan', 'Arhiba', 'Einguela'];
const OTHER_CITIES = ['Ali Sabieh', 'Tadjourah', 'Dikhil', 'Arta', 'Obock'];
const STREETS = ['Avenue Georges Clemenceau', 'Rue de Moscou', 'Boulevard de la République', 'Avenue 26', 'Rue d’Ethiopie', 'Route de Venise', 'Avenue Nasser', 'Boulevard du Général de Gaulle'];

const phone = () => `+253 77 ${rng.int(10, 99)} ${rng.int(10, 99)} ${rng.int(10, 99)}`;

function address(fullName: string, ph: string, i: number, def: boolean): CustomerAddress {
  const regional = i % 6 === 5;
  return {
    id: `addr_${i}_${def ? 'd' : 'w'}`,
    label: def ? 'Home' : 'Work',
    fullName,
    phone: ph,
    line1: `${rng.pick(STREETS)}, No. ${rng.int(3, 180)}`,
    district: regional ? undefined : rng.pick(DISTRICTS),
    city: regional ? rng.pick(OTHER_CITIES) : 'Djibouti',
    country: 'Djibouti',
    isDefault: def,
  };
}

export const customers: Customer[] = CUSTOMER_NAMES.map(([first, last], i) => {
  const ph = phone();
  const full = `${first} ${last}`;
  const joinedDays = i < 4 ? rng.int(1, 12) : rng.int(20, 520);
  const status: Customer['status'] = i === 13 ? 'blocked' : i === 24 || i === 27 ? 'inactive' : 'active';
  const addresses = [address(full, ph, i, true)];
  if (i % 4 === 0) addresses.push(address(full, ph, i, false));
  return {
    id: `cus_${String(i + 1).padStart(3, '0')}`,
    firstName: first,
    lastName: last,
    email: `${first}.${last}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@example.com',
    phone: ph,
    status,
    groups: [],
    ordersCount: 0,
    totalSpent: 0,
    averageOrder: 0,
    addresses,
    wishlistProductIds: [],
    marketingOptIn: rng.chance(0.6),
    notes: i === 20 ? 'Prefers delivery after 5pm. Buys for a local five-a-side team.' : undefined,
    joinedAt: daysAgo(joinedDays, rng.int(8, 20)),
  };
});
