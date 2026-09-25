import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingBag,
  Users,
  Megaphone,
  Star,
  LifeBuoy,
  BarChart3,
  Bell,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { PermissionKey } from '@/types';

export type NavBadgeKey = 'orders' | 'lowStock' | 'support' | 'reviews' | 'notifications' | 'refunds';

export interface NavLeaf {
  label: string;
  to: string;
  permission?: PermissionKey;
  badge?: NavBadgeKey;
  /** Match exactly (pathname + search) rather than by prefix. */
  exact?: boolean;
}

export interface NavItem extends Partial<NavLeaf> {
  id: string;
  label: string;
  icon: LucideIcon;
  children?: NavLeaf[];
}

export const NAVIGATION: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard', permission: 'dashboard:view' },
  {
    id: 'catalog',
    label: 'Catalog',
    icon: Package,
    children: [
      { label: 'Products', to: '/products', permission: 'products:view' },
      { label: 'Categories', to: '/categories', permission: 'categories:view' },
      { label: 'Brands', to: '/brands', permission: 'categories:view' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    children: [
      { label: 'Inventory', to: '/inventory', permission: 'inventory:view', exact: true },
      { label: 'Low Stock', to: '/inventory?status=low_stock', permission: 'inventory:view', badge: 'lowStock', exact: true },
      { label: 'Stock Movements', to: '/inventory/movements', permission: 'inventory:view' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: ShoppingBag,
    badge: 'orders',
    children: [
      { label: 'All Orders', to: '/orders', permission: 'orders:view', exact: true },
      { label: 'Pending', to: '/orders?status=pending', permission: 'orders:view', exact: true },
      { label: 'Processing', to: '/orders?status=processing', permission: 'orders:view', exact: true },
      { label: 'Shipped', to: '/orders?status=shipped', permission: 'orders:view', exact: true },
      { label: 'Delivered', to: '/orders?status=delivered', permission: 'orders:view', exact: true },
      { label: 'Cancelled', to: '/orders?status=cancelled', permission: 'orders:view', exact: true },
      { label: 'Refunds', to: '/orders?status=refunded', permission: 'orders:view', badge: 'refunds', exact: true },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    children: [
      { label: 'All Customers', to: '/customers', permission: 'customers:view', exact: true },
      { label: 'Customer Groups', to: '/customers/groups', permission: 'customers:view' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    children: [
      { label: 'Coupons', to: '/discounts/coupons', permission: 'discounts:view' },
      { label: 'Discounts', to: '/discounts/automatic', permission: 'discounts:view' },
      { label: 'Flash Sales', to: '/discounts/flash-sales', permission: 'discounts:view' },
      { label: 'Campaigns', to: '/marketing/campaigns', permission: 'discounts:view' },
    ],
  },
  { id: 'reviews', label: 'Reviews', icon: Star, to: '/reviews', permission: 'reviews:view', badge: 'reviews' },
  { id: 'support', label: 'Support', icon: LifeBuoy, to: '/support', permission: 'support:view', badge: 'support' },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    children: [
      { label: 'Sales', to: '/reports/sales', permission: 'reports:view' },
      { label: 'Products', to: '/reports/products', permission: 'reports:view' },
      { label: 'Customers', to: '/reports/customers', permission: 'reports:view' },
      { label: 'Inventory', to: '/reports/inventory', permission: 'reports:view' },
    ],
  },
  { id: 'notifications', label: 'Notifications', icon: Bell, to: '/notifications', badge: 'notifications' },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'Store Settings', to: '/settings/store', permission: 'settings:view' },
      { label: 'Shipping', to: '/settings/shipping', permission: 'settings:view' },
      { label: 'Payments', to: '/settings/payments', permission: 'settings:view' },
      { label: 'Notifications', to: '/settings/notifications', permission: 'settings:view' },
      { label: 'Admin Users', to: '/settings/admin-users', permission: 'settings:view' },
      { label: 'Roles & Permissions', to: '/settings/roles', permission: 'settings:view' },
      { label: 'Activity Log', to: '/settings/activity', permission: 'settings:view' },
    ],
  },
];

export interface RouteMeta {
  /** Path pattern using react-router syntax. */
  pattern: string;
  title: string;
  crumbs: { label: string; to?: string }[];
}

/** Page titles + breadcrumb trails. Most specific patterns first. */
export const ROUTE_META: RouteMeta[] = [
  { pattern: '/dashboard', title: 'Dashboard', crumbs: [] },
  { pattern: '/products/new', title: 'New Product', crumbs: [{ label: 'Catalog' }, { label: 'Products', to: '/products' }, { label: 'New' }] },
  { pattern: '/products/:id/edit', title: 'Edit Product', crumbs: [{ label: 'Catalog' }, { label: 'Products', to: '/products' }, { label: 'Edit' }] },
  { pattern: '/products/:id', title: 'Product', crumbs: [{ label: 'Catalog' }, { label: 'Products', to: '/products' }, { label: 'Details' }] },
  { pattern: '/products', title: 'Products', crumbs: [{ label: 'Catalog' }, { label: 'Products' }] },
  { pattern: '/categories', title: 'Categories', crumbs: [{ label: 'Catalog' }, { label: 'Categories' }] },
  { pattern: '/brands', title: 'Brands', crumbs: [{ label: 'Catalog' }, { label: 'Brands' }] },
  { pattern: '/inventory/movements', title: 'Stock Movements', crumbs: [{ label: 'Inventory', to: '/inventory' }, { label: 'Stock Movements' }] },
  { pattern: '/inventory', title: 'Inventory', crumbs: [{ label: 'Inventory' }] },
  { pattern: '/orders/:id', title: 'Order', crumbs: [{ label: 'Orders', to: '/orders' }, { label: 'Details' }] },
  { pattern: '/orders', title: 'Orders', crumbs: [{ label: 'Orders' }] },
  { pattern: '/customers/groups', title: 'Customer Groups', crumbs: [{ label: 'Customers', to: '/customers' }, { label: 'Groups' }] },
  { pattern: '/customers/:id', title: 'Customer', crumbs: [{ label: 'Customers', to: '/customers' }, { label: 'Details' }] },
  { pattern: '/customers', title: 'Customers', crumbs: [{ label: 'Customers' }] },
  { pattern: '/reviews', title: 'Reviews', crumbs: [{ label: 'Reviews' }] },
  { pattern: '/discounts/coupons', title: 'Coupons', crumbs: [{ label: 'Marketing' }, { label: 'Coupons' }] },
  { pattern: '/discounts/automatic', title: 'Discounts', crumbs: [{ label: 'Marketing' }, { label: 'Discounts' }] },
  { pattern: '/discounts/flash-sales', title: 'Flash Sales', crumbs: [{ label: 'Marketing' }, { label: 'Flash Sales' }] },
  { pattern: '/marketing/campaigns', title: 'Campaigns', crumbs: [{ label: 'Marketing' }, { label: 'Campaigns' }] },
  { pattern: '/reports/sales', title: 'Sales Report', crumbs: [{ label: 'Reports' }, { label: 'Sales' }] },
  { pattern: '/reports/products', title: 'Product Report', crumbs: [{ label: 'Reports' }, { label: 'Products' }] },
  { pattern: '/reports/customers', title: 'Customer Report', crumbs: [{ label: 'Reports' }, { label: 'Customers' }] },
  { pattern: '/reports/inventory', title: 'Inventory Report', crumbs: [{ label: 'Reports' }, { label: 'Inventory' }] },
  { pattern: '/support/:id', title: 'Ticket', crumbs: [{ label: 'Support', to: '/support' }, { label: 'Ticket' }] },
  { pattern: '/support', title: 'Support', crumbs: [{ label: 'Support' }] },
  { pattern: '/notifications', title: 'Notifications', crumbs: [{ label: 'Notifications' }] },
  { pattern: '/settings/store', title: 'Store Settings', crumbs: [{ label: 'Settings' }, { label: 'Store' }] },
  { pattern: '/settings/shipping', title: 'Shipping', crumbs: [{ label: 'Settings' }, { label: 'Shipping' }] },
  { pattern: '/settings/payments', title: 'Payments', crumbs: [{ label: 'Settings' }, { label: 'Payments' }] },
  { pattern: '/settings/notifications', title: 'Notification Settings', crumbs: [{ label: 'Settings' }, { label: 'Notifications' }] },
  { pattern: '/settings/admin-users', title: 'Admin Users', crumbs: [{ label: 'Settings' }, { label: 'Admin Users' }] },
  { pattern: '/settings/roles', title: 'Roles & Permissions', crumbs: [{ label: 'Settings' }, { label: 'Roles & Permissions' }] },
  { pattern: '/settings/activity', title: 'Activity Log', crumbs: [{ label: 'Settings' }, { label: 'Activity Log' }] },
  { pattern: '/profile', title: 'Profile', crumbs: [{ label: 'Profile' }] },
];
