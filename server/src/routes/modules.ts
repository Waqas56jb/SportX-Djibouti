import type { Router } from 'express';
import { catalogCustomerRoutes, catalogAdminRoutes } from './catalog.registry.js';
import { accountCustomerRoutes, accountAdminRoutes } from './account.registry.js';
import { opsAdminRoutes } from './ops.registry.js';

/**
 * Feature module registry. Each entry mounts a module router under /api/v1 (customer)
 * or /api/v1/admin (admin; requireAdmin is already applied by the parent router).
 */
export const customerRoutes: [string, Router][] = [...catalogCustomerRoutes, ...accountCustomerRoutes];
export const adminRoutes: [string, Router][] = [...catalogAdminRoutes, ...accountAdminRoutes, ...opsAdminRoutes];
