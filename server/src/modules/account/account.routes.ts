import { Router } from 'express';
import { query, queryOne } from '../../config/database.js';
import { asyncHandler } from '../../utils/http.js';
import { ok } from '../../utils/apiResponse.js';
import { unauthorized } from '../../utils/errors.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { getUser } from '../auth/auth.service.js';
import { toPublicUser } from '../users/users.mapper.js';
import { toOrderSummary, type OrderRow } from '../orders/orders.mapper.js';
import { addressesService } from '../addresses/addresses.service.js';
import { wishlistService } from '../wishlist/wishlist.service.js';
import { notificationsService } from '../notifications/notifications.service.js';
import { supportService } from '../support/support.service.js';

/** /api/v1/account — aggregated "My account" overview in one request. */
export const accountRouter = Router();
accountRouter.use(authenticate);

accountRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const user = await getUser(userId);
    if (!user) throw unauthorized('Account not found.');
    const scope = { kind: 'customer' as const, userId };

    const [counts, recent, wishlistCount, addresses, unreadNotifications, recentNotifications, openTickets, reviews] = await Promise.all([
      queryOne<{ total: number; active: number; pending: number; delivered: number; cancelled: number }>(
        `select count(*)::int as total,
                count(*) filter (where status not in ('DELIVERED', 'CANCELLED', 'REFUNDED'))::int as active,
                count(*) filter (where status in ('PENDING', 'PAYMENT_PENDING'))::int as pending,
                count(*) filter (where status = 'DELIVERED')::int as delivered,
                count(*) filter (where status in ('CANCELLED', 'REFUNDED'))::int as cancelled
           from public.orders where user_id = $1 and deleted_at is null`,
        [userId],
      ),
      query<OrderRow & { first_item_image: string | null }>(
        `select o.*, (select image_url from public.order_items i where i.order_id = o.id order by i.created_at limit 1) as first_item_image
           from public.orders o where o.user_id = $1 and o.deleted_at is null order by o.placed_at desc limit 5`,
        [userId],
      ),
      wishlistService.count(userId),
      addressesService.list(userId),
      notificationsService.unreadCount(scope),
      notificationsService.recent(scope, 5),
      supportService.openCount(userId),
      queryOne<{ n: number }>(`select count(*)::int as n from public.reviews where user_id = $1 and deleted_at is null`, [userId]),
    ]);

    return ok(res, {
      user: toPublicUser(user),
      orderCounts: counts ?? { total: 0, active: 0, pending: 0, delivered: 0, cancelled: 0 },
      recentOrders: recent.map(toOrderSummary),
      wishlistCount,
      addressesCount: addresses.length,
      defaultAddress: addresses.find((a) => a.isDefault) ?? null,
      unreadNotifications,
      recentNotifications,
      openTickets,
      reviewsCount: reviews?.n ?? 0,
    });
  }),
);
