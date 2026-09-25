import type { PermissionAction, PermissionKey, PermissionModule } from '@/types';

export const PERMISSION_MODULES: { module: PermissionModule; label: string; description: string; actions: PermissionAction[] }[] = [
  { module: 'dashboard', label: 'Dashboard', description: 'Executive overview and KPIs', actions: ['view', 'export'] },
  { module: 'products', label: 'Products', description: 'Catalogue, variants, media, pricing', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
  { module: 'categories', label: 'Categories & Brands', description: 'Category tree and brand directory', actions: ['view', 'create', 'edit', 'delete'] },
  { module: 'inventory', label: 'Inventory', description: 'Stock levels and adjustments', actions: ['view', 'create', 'edit', 'approve', 'export'] },
  { module: 'orders', label: 'Orders', description: 'Fulfilment, refunds, shipping', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
  { module: 'customers', label: 'Customers', description: 'Profiles, groups and status', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { module: 'reviews', label: 'Reviews', description: 'Moderation of product reviews', actions: ['view', 'edit', 'delete', 'approve'] },
  { module: 'discounts', label: 'Marketing', description: 'Coupons, discounts, flash sales, campaigns', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
  { module: 'reports', label: 'Reports', description: 'Sales, product, customer, inventory reports', actions: ['view', 'export'] },
  { module: 'support', label: 'Support', description: 'Customer support tickets', actions: ['view', 'create', 'edit', 'delete'] },
  { module: 'settings', label: 'Settings', description: 'Store, shipping, payments, admins, roles', actions: ['view', 'create', 'edit', 'delete'] },
];

export const PERMISSION_ACTIONS: { action: PermissionAction; label: string }[] = [
  { action: 'view', label: 'View' },
  { action: 'create', label: 'Create' },
  { action: 'edit', label: 'Edit' },
  { action: 'delete', label: 'Delete' },
  { action: 'approve', label: 'Approve' },
  { action: 'export', label: 'Export' },
];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_MODULES.flatMap((m) => m.actions.map((a) => `${m.module}:${a}` as PermissionKey));

/** Build a permission list for the given modules with the given actions (only those supported by each module). */
export function grant(modules: PermissionModule[], actions: PermissionAction[] | 'all'): PermissionKey[] {
  return PERMISSION_MODULES.filter((m) => modules.includes(m.module)).flatMap((m) =>
    m.actions.filter((a) => actions === 'all' || actions.includes(a)).map((a) => `${m.module}:${a}` as PermissionKey),
  );
}
