import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import type { PermissionKey } from '@/types';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { GuestRoute, ProtectedRoute, RequirePermission } from './guards';
import LoginPage from '@/pages/auth/LoginPage';
import NotFoundPage from '@/pages/NotFoundPage';

type Page = LazyExoticComponent<ComponentType>;
const p = (loader: () => Promise<{ default: ComponentType }>): Page => lazy(loader);

// Route-level code splitting: each module loads on first visit.
const Pages = {
  Dashboard: p(() => import('@/pages/dashboard/DashboardPage')),
  Products: p(() => import('@/pages/products/ProductsPage')),
  ProductForm: p(() => import('@/pages/products/ProductFormPage')),
  ProductDetail: p(() => import('@/pages/products/ProductDetailPage')),
  Categories: p(() => import('@/pages/categories/CategoriesPage')),
  Brands: p(() => import('@/pages/brands/BrandsPage')),
  Inventory: p(() => import('@/pages/inventory/InventoryPage')),
  StockMovements: p(() => import('@/pages/inventory/StockMovementsPage')),
  Orders: p(() => import('@/pages/orders/OrdersPage')),
  OrderDetail: p(() => import('@/pages/orders/OrderDetailPage')),
  Customers: p(() => import('@/pages/customers/CustomersPage')),
  CustomerDetail: p(() => import('@/pages/customers/CustomerDetailPage')),
  CustomerGroups: p(() => import('@/pages/customers/CustomerGroupsPage')),
  Reviews: p(() => import('@/pages/reviews/ReviewsPage')),
  Coupons: p(() => import('@/pages/discounts/CouponsPage')),
  Discounts: p(() => import('@/pages/discounts/DiscountsPage')),
  FlashSales: p(() => import('@/pages/discounts/FlashSalesPage')),
  Campaigns: p(() => import('@/pages/campaigns/CampaignsPage')),
  SalesReport: p(() => import('@/pages/reports/SalesReportPage')),
  ProductReport: p(() => import('@/pages/reports/ProductReportPage')),
  CustomerReport: p(() => import('@/pages/reports/CustomerReportPage')),
  InventoryReport: p(() => import('@/pages/reports/InventoryReportPage')),
  Support: p(() => import('@/pages/support/SupportPage')),
  TicketDetail: p(() => import('@/pages/support/TicketDetailPage')),
  Notifications: p(() => import('@/pages/notifications/NotificationsPage')),
  StoreSettings: p(() => import('@/pages/settings/StoreSettingsPage')),
  ShippingSettings: p(() => import('@/pages/settings/ShippingSettingsPage')),
  PaymentSettings: p(() => import('@/pages/settings/PaymentSettingsPage')),
  NotificationSettings: p(() => import('@/pages/settings/NotificationSettingsPage')),
  AdminUsers: p(() => import('@/pages/settings/AdminUsersPage')),
  Roles: p(() => import('@/pages/settings/RolesPage')),
  ActivityLog: p(() => import('@/pages/settings/ActivityLogPage')),
  Profile: p(() => import('@/pages/profile/ProfilePage')),
};

const guard = (Page: Page, permission?: PermissionKey | PermissionKey[]) => (
  <RequirePermission permission={permission}>
    <Page />
  </RequirePermission>
);

const adminRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="/dashboard" replace /> },
  { path: 'dashboard', element: guard(Pages.Dashboard, 'dashboard:view') },
  { path: 'products', element: guard(Pages.Products, 'products:view') },
  { path: 'products/new', element: guard(Pages.ProductForm, 'products:create') },
  { path: 'products/:id', element: guard(Pages.ProductDetail, 'products:view') },
  { path: 'products/:id/edit', element: guard(Pages.ProductForm, 'products:edit') },
  { path: 'categories', element: guard(Pages.Categories, 'categories:view') },
  { path: 'brands', element: guard(Pages.Brands, 'categories:view') },
  { path: 'inventory', element: guard(Pages.Inventory, 'inventory:view') },
  { path: 'inventory/movements', element: guard(Pages.StockMovements, 'inventory:view') },
  { path: 'orders', element: guard(Pages.Orders, 'orders:view') },
  { path: 'orders/:id', element: guard(Pages.OrderDetail, 'orders:view') },
  { path: 'customers', element: guard(Pages.Customers, 'customers:view') },
  { path: 'customers/groups', element: guard(Pages.CustomerGroups, 'customers:view') },
  { path: 'customers/:id', element: guard(Pages.CustomerDetail, 'customers:view') },
  { path: 'reviews', element: guard(Pages.Reviews, 'reviews:view') },
  { path: 'discounts', element: <Navigate to="/discounts/coupons" replace /> },
  { path: 'discounts/coupons', element: guard(Pages.Coupons, 'discounts:view') },
  { path: 'discounts/automatic', element: guard(Pages.Discounts, 'discounts:view') },
  { path: 'discounts/flash-sales', element: guard(Pages.FlashSales, 'discounts:view') },
  { path: 'marketing/campaigns', element: guard(Pages.Campaigns, 'discounts:view') },
  { path: 'reports', element: <Navigate to="/reports/sales" replace /> },
  { path: 'reports/sales', element: guard(Pages.SalesReport, 'reports:view') },
  { path: 'reports/products', element: guard(Pages.ProductReport, 'reports:view') },
  { path: 'reports/customers', element: guard(Pages.CustomerReport, 'reports:view') },
  { path: 'reports/inventory', element: guard(Pages.InventoryReport, 'reports:view') },
  { path: 'support', element: guard(Pages.Support, 'support:view') },
  { path: 'support/:id', element: guard(Pages.TicketDetail, 'support:view') },
  { path: 'notifications', element: guard(Pages.Notifications) },
  { path: 'settings', element: <Navigate to="/settings/store" replace /> },
  { path: 'settings/store', element: guard(Pages.StoreSettings, 'settings:view') },
  { path: 'settings/shipping', element: guard(Pages.ShippingSettings, 'settings:view') },
  { path: 'settings/payments', element: guard(Pages.PaymentSettings, 'settings:view') },
  { path: 'settings/notifications', element: guard(Pages.NotificationSettings, 'settings:view') },
  { path: 'settings/admin-users', element: guard(Pages.AdminUsers, 'settings:view') },
  { path: 'settings/roles', element: guard(Pages.Roles, 'settings:view') },
  { path: 'settings/activity', element: guard(Pages.ActivityLog, 'settings:view') },
  { path: 'profile', element: guard(Pages.Profile) },
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <GuestRoute>
        <LoginPage />
      </GuestRoute>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [{ path: '/', element: <AdminLayout />, children: adminRoutes }],
  },
]);
