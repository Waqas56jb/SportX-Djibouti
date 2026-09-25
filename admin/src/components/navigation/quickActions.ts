import { Boxes, FolderPlus, Megaphone, PackagePlus, ShoppingBag, TicketPercent, type LucideIcon } from 'lucide-react';
import type { PermissionKey } from '@/types';

export interface QuickAction {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  permission: PermissionKey;
}

/** Deep links; `?new=1` / `?adjust=1` tell the target page to open its create/adjust panel. */
export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'add-product', label: 'Add Product', to: '/products/new', icon: PackagePlus, permission: 'products:create' },
  { id: 'adjust-inventory', label: 'Adjust Inventory', to: '/inventory?adjust=1', icon: Boxes, permission: 'inventory:edit' },
  { id: 'create-coupon', label: 'Create Coupon', to: '/discounts/coupons?new=1', icon: TicketPercent, permission: 'discounts:create' },
  { id: 'view-orders', label: 'View Orders', to: '/orders', icon: ShoppingBag, permission: 'orders:view' },
  { id: 'create-campaign', label: 'Create Campaign', to: '/marketing/campaigns?new=1', icon: Megaphone, permission: 'discounts:create' },
  { id: 'add-category', label: 'Add Category', to: '/categories?new=1', icon: FolderPlus, permission: 'categories:create' },
];
