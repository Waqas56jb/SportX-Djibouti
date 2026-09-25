import { Router } from 'express';
import { requireAdmin } from '../middleware/admin.middleware.js';
import { adminAuthRouter, authRouter } from '../modules/auth/auth.routes.js';
import { checkoutRouter, ordersRouter } from '../modules/orders/orders.routes.js';
import { adminOrdersRouter } from '../modules/orders/admin-orders.routes.js';
import { paymentsRouter } from '../modules/payments/payments.routes.js';
import { shippingRouter, storeRouter } from '../modules/shipping/shipping.routes.js';
import { customerRoutes, adminRoutes } from './modules.js';

/** Everything under /api/v1. */
export const apiRouter = Router();

// ─── Public & customer ──────────────────────────────────────────────────────
apiRouter.use('/auth', authRouter);
apiRouter.use('/store', storeRouter);
apiRouter.use('/shipping', shippingRouter);
apiRouter.use('/checkout', checkoutRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/payments', paymentsRouter);
for (const [path, router] of customerRoutes) apiRouter.use(path, router);

// ─── Admin (every route behind authentication + staff role; permissions per route) ─
apiRouter.use('/admin/auth', adminAuthRouter);
const admin = Router();
admin.use(...requireAdmin);
admin.use('/orders', adminOrdersRouter);
for (const [path, router] of adminRoutes) admin.use(path, router);
apiRouter.use('/admin', admin);
