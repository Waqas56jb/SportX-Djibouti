import type { Router } from 'express';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { reportsRouter } from '../modules/reports/reports.routes.js';
import { adminCustomersRouter } from '../modules/admin-customers/admin-customers.routes.js';
import { adminInventoryRouter } from '../modules/inventory/inventory.routes.js';
import { adminCouponsRouter } from '../modules/coupons/admin-coupons.routes.js';
import { discountsRouter } from '../modules/discounts/discounts.routes.js';
import { flashSalesRouter } from '../modules/flash-sales/flash-sales.routes.js';
import { campaignsRouter } from '../modules/campaigns/campaigns.routes.js';
import { adminShippingRouter } from '../modules/shipping/admin-shipping.routes.js';
import { adminSettingsRouter } from '../modules/settings/settings.routes.js';
import { staffRouter } from '../modules/staff/staff.routes.js';
import { permissionsRouter, rolesRouter } from '../modules/roles/roles.routes.js';
import { activityRouter } from '../modules/activity/activity.routes.js';
import { searchRouter } from '../modules/search/search.routes.js';

/**
 * Admin operations routes (dashboard, reports, customers, inventory, marketing, settings, staff).
 * [mount path, router] — mounted under /api/v1/admin with requireAdmin applied; each route checks its permission.
 * Aliases (/admin-users, /activity, /settings/shipping) match the paths the admin UI already calls.
 */
export const opsAdminRoutes: [string, Router][] = [
  ['/dashboard', dashboardRouter],
  ['/reports', reportsRouter],
  ['/customers', adminCustomersRouter],
  ['/inventory', adminInventoryRouter],
  ['/coupons', adminCouponsRouter],
  ['/discounts', discountsRouter],
  ['/flash-sales', flashSalesRouter],
  ['/campaigns', campaignsRouter],
  ['/shipping', adminShippingRouter],
  ['/settings/shipping', adminShippingRouter],
  ['/settings', adminSettingsRouter],
  ['/staff', staffRouter],
  ['/admin-users', staffRouter],
  ['/roles', rolesRouter],
  ['/permissions', permissionsRouter],
  ['/activity-logs', activityRouter],
  ['/activity', activityRouter],
  ['/search', searchRouter],
];
