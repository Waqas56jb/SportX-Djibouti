# Server conventions (read before adding a module)

**Stack.** Express 4 + TypeScript (ESM, `.js` import suffixes) + `pg` against Supabase Postgres. Zod validation. No ORM.

## Layout per module (`src/modules/<name>/`)
- `<name>.schema.ts` — Zod schemas (body / query / params).
- `<name>.repository.ts` — SQL (only where it helps; small modules may keep SQL in the service).
- `<name>.service.ts` — business rules. Throw `AppError` (`src/utils/errors.ts`) for expected failures.
- `<name>.mapper.ts` — row → API JSON (camelCase, ISO dates, no secrets / internal ids that shouldn't leak).
- `<name>.routes.ts` — routers. Controllers can be inline `asyncHandler(async (req, res) => …)` when tiny, or a `<name>.controller.ts`.
- Register routers in your registry file in `src/routes/*.registry.ts` as `[mountPath, router]`. Admin routers are mounted under `/api/v1/admin` with `requireAdmin` already applied — add `requirePermission('module:action')` per route.

## Rules
- **Database**: `query/queryOne/withTransaction` from `src/config/database.ts`. Always bound parameters (`$1`). Never interpolate user input into SQL — whitelisted identifiers only (e.g. zod enum for sort columns). When inside a transaction, pass the `tx` client to *every* helper you call (tests run with a pool of ONE connection: using `pool` inside a transaction deadlocks). Cast parameters reused in different type contexts (`$2::public.order_status`).
- **Identity**: `req.auth!.userId` from `authenticate` / `requireAdmin`. Never accept a user id from the client for ownership. Ownership checks return `404` (not 403) for other users' records.
- **Responses**: `ok(res, data, message?)`, `created`, `paginated(res, rows, pageMeta(page, limit, total))`, `noContent`. Errors go through `next(err)` / thrown `AppError` → `{ success:false, error:{ code, message, details?, requestId } }`.
- **Validation**: `validate({ body, query, params })`; read query with `query<T>(req)` (`src/middleware/validation.middleware.ts`). Pagination: `paginationQuery()` / `adminListQuery([...sorts])` from `src/utils/pagination.ts`; response meta: `page, limit, total, totalPages, hasNext, hasPrevious`.
- **Money**: integer DJF. Prices/totals ONLY via `priceCart` (`src/modules/pricing/pricing.service.ts`). Never trust client prices.
- **Inventory**: only via `src/modules/inventory/inventory.core.ts` (`reserveStock`, `adjustStock`, `commitOrderStock`, `releaseOrderStock`, `restockOrder`). Every change writes `inventory_movements`.
- **Orders**: status changes only via `transitionOrder` (`src/modules/orders/order.state.ts`); run `runAfterCommit(after)` after the transaction.
- **Audit**: important admin mutations call `audit(req, { action, entityType, entityId, metadata }, tx?)` (`src/services/audit.service.ts`). Human-readable action names ("Product created", "Stock adjusted", "Coupon created", "Customer status changed").
- **Notifications**: `notificationService.toUser(userId, …, tx?)` / `toStaff(…)`. Email: `emailService.queue(template, to, vars)` — after commit.
- **Uploads**: `imageUpload.single('file')` middleware + `storageService.putImage(folder, ownerId, req.file)`; store `url` and `path`; `storageService.remove(path)` on delete.
- **Rate limits**: `couponLimiter`, `reviewLimiter`, `writeLimiter` etc. from `src/middleware/rateLimit.middleware.ts`.
- **Statuses**: UPPER_SNAKE enums exactly as in the migrations (`src/types/common.ts`).
- **Soft delete**: products, product_variants, coupons, reviews, users, orders have `deleted_at`; filter `deleted_at is null` in reads. Products referenced by orders are archived, not hard-deleted.

## Testing
- `npx vitest run tests/integration/<file>.test.ts` (set a unique `TEST_DB_PORT` env var if several runs happen at once).
- Helpers in `tests/helpers/fixtures.ts`: `resetData`, `registerCustomer`, `createStaff(role)`, `createProduct`, `putInCart`, `api()`, `auth(token)`.
- Test behaviour and rules (ownership, validation, permission, state), not just 200s.
