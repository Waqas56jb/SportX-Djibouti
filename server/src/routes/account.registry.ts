import type { Router } from 'express';
import { usersRouter } from '../modules/users/users.routes.js';
import { addressesRouter } from '../modules/addresses/addresses.routes.js';
import { accountRouter } from '../modules/account/account.routes.js';
import { cartRouter } from '../modules/cart/cart.routes.js';
import { wishlistRouter } from '../modules/wishlist/wishlist.routes.js';
import { couponsRouter } from '../modules/coupons/coupons.routes.js';
import { adminReviewsRouter, customerReviewsRouter } from '../modules/reviews/reviews.routes.js';
import { adminNotificationsRouter, notificationsRouter } from '../modules/notifications/notifications.routes.js';
import { adminSupportRouter, supportRouter } from '../modules/support/support.routes.js';
import { contactRouter, newsletterRouter } from '../modules/marketing/marketing.routes.js';

/**
 * Routes owned by the account modules. [mount path, router].
 * Note: `productReviewsRouter` (reviews.routes.ts) is mounted by the catalog registry at /products/:id/reviews.
 */
export const accountCustomerRoutes: [string, Router][] = [
  ['/users', usersRouter],
  ['/addresses', addressesRouter],
  ['/account', accountRouter],
  ['/cart', cartRouter],
  ['/wishlist', wishlistRouter],
  ['/coupons', couponsRouter],
  ['/reviews', customerReviewsRouter],
  ['/notifications', notificationsRouter],
  ['/support', supportRouter],
  ['/newsletter', newsletterRouter],
  ['/contact', contactRouter],
];

export const accountAdminRoutes: [string, Router][] = [
  ['/reviews', adminReviewsRouter],
  ['/notifications', adminNotificationsRouter],
  ['/support', adminSupportRouter],
];
