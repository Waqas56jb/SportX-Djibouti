import type { Router } from 'express';
import { brandsRouter, categoriesRouter, productsRouter } from '../modules/catalog/catalog.routes.js';
import { adminBrandsRouter, adminCategoriesRouter, adminProductsRouter } from '../modules/catalog/catalog.admin.routes.js';

/** Routes owned by the catalog modules. [mount path, router]. */
export const catalogCustomerRoutes: [string, Router][] = [
  ['/products', productsRouter],
  ['/categories', categoriesRouter],
  ['/brands', brandsRouter],
];
export const catalogAdminRoutes: [string, Router][] = [
  ['/products', adminProductsRouter],
  ['/categories', adminCategoriesRouter],
  ['/brands', adminBrandsRouter],
];
