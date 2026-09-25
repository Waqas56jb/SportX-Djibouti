# SPORTX API

Production backend for **SPORTX** (Djibouti) — one REST API serving the customer storefront (`customer/`) and the admin (`admin/`).

**Stack:** Node.js 20+ · TypeScript · Express 4 · Supabase (PostgreSQL, Auth, Storage) · Zod · Vitest.

```
React storefront ─┐                     ┌─▶ Supabase Auth (credentials, email confirm, recovery)
                  ├─▶ SPORTX REST API ──┼─▶ Supabase PostgreSQL (source of truth, RLS)
React admin ──────┘   /api/v1           └─▶ Supabase Storage (product / category / brand / avatar images)
```

The API is the business layer: prices, stock, coupons, order status, payments and permissions are always decided here — never by the browser.

---

## 1. Quick start (local, no Docker, no Supabase project)

```bash
git clone <repo> && cd SportX-Djibouti/server
npm install
cp .env.example .env
#   set in .env:  PORT=4100  API_BASE_URL=http://localhost:4100
#                 SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD   (your local admin)
#                 SEED_DEMO_CUSTOMER_EMAIL / SEED_DEMO_CUSTOMER_PASSWORD (optional)
npm run dev:local
```

`dev:local` starts an embedded PostgreSQL (PGlite, persisted in `./.local-db`), applies every migration, seeds the catalogue and demo accounts, and runs the API (no auto-reload — the embedded database allows one connection, so restart `dev:local` after changing server code; use `npm run dev` against a real Postgres for hot reload). It forces local auth, local file storage (`./uploads`) and the `cash_on_delivery` + `mock` payment providers. Delete `.local-db/` to start fresh.

Then run the frontends (each in its own terminal):

```bash
cd ../customer && echo "VITE_API_URL=http://localhost:4100" > .env.local && npm install && npm run dev   # http://localhost:5173
cd ../admin    && echo "VITE_API_URL=http://localhost:4100" > .env.local && npm install && npm run dev   # http://localhost:5174
```

> Port 4000 is the default; use another port if something else already listens on it (the frontends only need `VITE_API_URL`).

## 2. Setup with a real Supabase project

1. **Create a project** at supabase.com. Note the project URL, anon key, service-role key and the database connection string (Project Settings → API / Database).
2. **Configure** `server/.env` from `.env.example`:
   - `DATABASE_URL` (session pooler or direct connection), `DATABASE_SSL=true`
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_PROVIDER=supabase`, `STORAGE_PROVIDER=supabase`
   - `JWT_SECRET` — 48 random bytes: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
   - `FRONTEND_URL`, `ADMIN_FRONTEND_URL` (CORS + email links), `PAYMENT_PROVIDERS`, email provider.
3. **Supabase Auth settings** (dashboard → Authentication): enable Email provider; set *Site URL* to the storefront and add `https://<storefront>/reset-password`, `https://<storefront>/verify-email`, `https://<admin>/reset-password` to *Redirect URLs*; configure SMTP for production emails. Set `EMAIL_VERIFICATION_REQUIRED=true` if customers must confirm their email.
4. **Run migrations** — `npm run db:migrate` (or `supabase db push` with the Supabase CLI; the files live in `supabase/migrations`). Migrations are idempotent and tracked in `public.schema_migrations`. They create every table, enum, constraint, index, trigger, RLS policy, the storage bucket `sportx-media`, roles/permissions and default store & shipping settings.
5. **Seed** (optional demo catalogue) — `npm run db:seed` (`-- --force` reloads the catalogue).
   The demo catalogue is sports-only test data (WOLF football boots, turf shoes, jerseys, team kits, polos, tees, shorts,
   tracksuits, socks, bags, goalkeeper gloves, balls). Photos are Unsplash URLs plus the client's own WOLF product shots in
   `supabase/seed/media/` (referenced as `seed-media:<file>`): with `SUPABASE_SERVICE_ROLE_KEY` set they are uploaded to
   the storage bucket under `seed/`; otherwise they are copied to `LOCAL_UPLOAD_DIR/seed` and served from `/uploads`.
   Delete the demo products from the admin (or run `--force` with your own JSON) when real data is ready.
6. **Create the first admin** — never hard-coded:
   ```bash
   ADMIN_EMAIL=owner@your-domain ADMIN_PASSWORD='a-strong-password-1' npm run create-admin
   ```
   Further staff are invited from Admin → Settings → Admin users (they receive a set-password email).
7. **Start** — `npm run dev` (watch) or `npm run build && npm start`.

## 3. Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev:local` | Embedded Postgres + migrate + seed + API (local development) |
| `npm run dev` | API with auto-reload against `DATABASE_URL` |
| `npm run db:migrate` / `db:reset` | Apply migrations / drop + migrate + seed (never in production) |
| `npm run db:seed` | Demo catalogue, coupons, optional demo accounts |
| `npm run create-admin` | Provision a staff account from `ADMIN_*` env vars |
| `npm test` | Integration tests against an in-memory PostgreSQL |
| `npm run typecheck` / `build` / `start` | Type-check · compile to `dist/` · run compiled server |
| `npm run start:migrate` / `start:seed` / `start:create-admin` | Compiled scripts for production images |
| `npx tsx scripts/list-routes.ts` | Regenerate `docs/ROUTES.md` |

## 4. Architecture

```
src/
  app.ts, server.ts          Express app (helmet, CORS allow-list, request id, pino logging, rate limits) · process entry
  config/                    env (Zod-validated, fails fast), database (pg pool, withTransaction), supabase clients
  middleware/                auth · admin · role (permissions) · validation · rate limit · upload · request id · errors
  modules/<feature>/         schema (Zod) · service (rules) · repository/SQL · mapper (API shape) · routes
    auth/                    tokens (JWT + rotating refresh sessions), credential providers (supabase | local)
    catalog/                 public catalogue (filters, facets, search) + admin products/variants/images/categories/brands
    pricing/                 priceCart — the ONLY place money is computed (discounts, flash sales, coupons, shipping, tax)
    inventory/               inventory.core (reserve / commit / release / restock / adjust, movements) + admin routes
    orders/                  checkout workflow, order state machine, customer + admin routes
    payments/                payment service, refunds, webhooks
    cart, wishlist, addresses, users, account, reviews, notifications, support, coupons, discounts, flash-sales,
    campaigns, settings, shipping, dashboard, reports, admin-customers, staff, roles, activity, search, marketing
  services/                  email (console|smtp|resend), payment providers (cod|stripe|mock), shipping provider,
                             storage (supabase|local, magic-byte image checks), notifications, audit log, job runner
  jobs/                      recurring jobs (expire unpaid orders, prune sessions)
supabase/migrations/         reproducible schema    supabase/seed/data/   seed catalogue (JSON)   supabase/seed/media/  seed product photos
tests/integration/           business-behaviour tests (auth, orders, payments, catalog, account, ops)
```

Conventions for contributors: [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md). Endpoint reference: [`docs/API.md`](docs/API.md) and the generated list [`docs/ROUTES.md`](docs/ROUTES.md).

## 5. Authentication

- **One strategy for both apps.** The API issues short-lived access tokens (JWT, 15 min, `Authorization: Bearer`). Refresh tokens are opaque, stored **hashed** in `auth_sessions`, rotated on every use and delivered only in an **HttpOnly, Secure, SameSite** cookie (`sportx_rt` for the storefront, `sportx_admin_rt` for the admin, path `/api/v1`). Frontends keep the access token in memory and call `POST /auth/refresh` (`/admin/auth/refresh`) on load and when it expires.
- Replaying an already-rotated refresh token revokes all of that user's sessions (theft signal). Password reset/change revokes other sessions.
- **Credentials** live in Supabase Auth (`AUTH_PROVIDER=supabase`); `local` (scrypt hashes in Postgres) is for development/tests only and refused in production. Accounts created while running with `local` are migrated automatically: on their next successful sign-in (or password reset) the legacy hash is verified once, a Supabase Auth user is created and linked, and the hash is deleted.
- Supabase Auth emails (password recovery, confirmation) redirect back with `#access_token=…`; both frontends read it. In the Supabase dashboard set **Auth → URL Configuration**: Site URL = the storefront URL, and add `<storefront>/reset-password`, `<storefront>/verify-email` and `<admin>/reset-password` to Redirect URLs. Supabase's built-in email sender only delivers to project team members and is rate limited — configure custom SMTP (Auth → SMTP settings) before going live. Google/Apple sign-in can be enabled in Supabase Auth later without changing business code.
- Identity always comes from the verified token; user ids in URLs/bodies are never trusted for ownership. Other users' records return `404`.

## 6. Admin roles & permissions

Permissions are `module:action` keys (`orders:edit`, `reports:export` …) stored in `role_permissions` and checked on every admin route (`requirePermission`). Default roles:

| Role | Access |
| --- | --- |
| SUPER_ADMIN | Everything (immutable) |
| ADMIN | All operations; cannot create/delete staff or roles |
| PRODUCT_MANAGER | Products, variants, categories, brands, review moderation, inventory (view), reports |
| ORDER_MANAGER | Orders, shipping, refunds, customers (view), support (view/edit), reports |
| INVENTORY_MANAGER | Inventory adjustments, products (view/edit variants), reports |
| SUPPORT_MANAGER | Support tickets, customers (view/edit), orders (view), review approval |
| CUSTOMER | Storefront only |

Custom roles can be created in Admin → Roles & Permissions. Admin APIs also require an admin-scoped token (issued only by `/admin/auth/login` to staff).

## 7. Commerce rules (enforced server-side)

- **Pricing**: `priceCart` computes subtotal → best automatic discount or flash sale per unit (no stacking) → coupon → shipping (free at the store threshold) → tax (configurable, inclusive or exclusive) → grand total. Client prices are ignored.
- **Inventory**: `available = stock − reserved`, never negative (DB constraints). Placing an order **reserves** stock with a conditional atomic update — two buyers cannot both get the last unit. Payment confirmation (or shipment for cash on delivery) **commits** the stock; cancellation **releases** or **restocks**. Every change writes `inventory_movements`.
- **Orders**: created in one transaction (price, reserve, order + item snapshots, shipping, payment record, coupon usage, clear cart) with `Idempotency-Key` support. Status changes only through the state machine (`order.state.ts`), recorded in `order_status_history`. Unpaid online orders expire after `pending_payment_ttl_minutes` and release stock.
- **Payments**: provider abstraction (`cash_on_delivery`, `stripe`, `mock` for development). Only a **verified webhook** marks an online payment paid; webhooks are idempotent via `payment_events(provider, event_id)`. Staff can confirm only offline payments (cash, bank transfer). No card data is ever stored or received.
- **Refunds**: validated against the refundable balance, executed through the provider, then recorded atomically (payment/order totals, optional restock, order → REFUNDED/CANCELLED). Idempotent with `Idempotency-Key`.
- **Reviews**: only customers with a delivered order containing the product; moderated (PENDING → APPROVED); ratings recomputed by a DB trigger from approved reviews.
- **Coupons**: active window, usage limit (row-locked at checkout), per-customer limit, minimum order, maximum discount, product/category/customer-group restrictions.

## 8. Payments setup (Stripe)

1. `PAYMENT_PROVIDERS=cash_on_delivery,stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
2. Stripe dashboard → Webhooks → endpoint `https://<api>/api/v1/payments/webhook/stripe` with events `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`.
3. The storefront confirms the PaymentIntent with Stripe.js using the `clientSecret` from `POST /api/v1/payments/create` (publishable key in the storefront's `VITE_STRIPE_PUBLISHABLE_KEY`). DJF is a zero-decimal currency in Stripe.
A local mobile-money operator can be added by implementing `PaymentProvider` (`src/services/payment/payment.provider.ts`) and registering it in `payment.registry.ts`.

## 9. Security

Helmet headers · CORS allow-list (storefront + admin URLs; no `*`) · per-route rate limits (login/register/reset/coupon/payment/review stricter) · Zod validation of every body/query/param · parameterised SQL only · safe error envelope (no stack traces or SQL details) · request ids · structured logs with redaction of passwords/tokens/cookies/card fields · uploads limited to JPEG/PNG/WebP/AVIF verified by magic bytes, random file names, size limit · secrets only in environment variables · service-role key never leaves the server · RLS enabled on every table (anon/authenticated clients can only read the public catalogue and their own records; all writes go through the API).

## 10. Response format

```json
{ "success": true, "data": { … }, "message": "optional" }
{ "success": true, "data": [ … ], "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3, "hasNext": true, "hasPrevious": false } }
{ "success": false, "error": { "code": "OUT_OF_STOCK", "message": "Only 1 left of …", "details": { … }, "requestId": "…" } }
```

Error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `OUT_OF_STOCK`, `INVALID_COUPON`, `PAYMENT_FAILED`, `ORDER_INVALID`, `RATE_LIMITED`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_INACTIVE`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `INTERNAL_ERROR`.

## 11. Testing

`npm test` starts an in-memory PostgreSQL, applies all migrations and runs the integration suites (auth, checkout/orders/payments/refunds, catalog, account, admin operations). Tests assert business behaviour — ownership isolation, permissions, stock races, idempotency, webhook signatures, coupon limits, state transitions — not just status codes.

## 12. Deployment

The API is stateless apart from the in-process job runner (run jobs on one instance: `JOBS_ENABLED=false` elsewhere) and the in-memory rate-limit store (use a shared store when scaling out).

- **Docker**: `docker build -t sportx-api .` → `docker run --env-file .env -p 4000:4000 sportx-api`. Release step: `docker run --env-file .env sportx-api npm run start:migrate`.
- **Railway** (current hosting): service root directory `server`; `railway.json` builds the `Dockerfile` and health-checks `/health` (a failing deploy never replaces the running one). Set every variable from the production checklist below in the service's Variables tab; the frontends are separate services (`customer`, `admin`) whose `VITE_API_URL` comes from their committed `.env.production` (a Railway variable of the same name overrides it). Run migrations after schema changes with `npm run db:migrate` against the production `DATABASE_URL`.
- **Render**: build `npm ci && npm run build`, start `npm start`, pre-deploy `npm run start:migrate`, health check `/health`, `TRUST_PROXY=1`.
- **AWS / VPS**: run the Docker image (ECS/Fargate, App Runner, or a VM behind Nginx with TLS); set `TRUST_PROXY=1`; keep secrets in the platform's secret store.
- **Region**: deploy the API in the same region as the Supabase project (this project: `ap-southeast-1`, Singapore). Each database round trip is ~150–190 ms from outside the region but a few ms inside it, and pages like the dashboard make several.
- Production checklist: `NODE_ENV=production`, `API_BASE_URL`, `FRONTEND_URL`, `ADMIN_FRONTEND_URL` (these two are the CORS allow-list and email link bases), `DATABASE_URL` + `DATABASE_SSL=true`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (publishable key), `SUPABASE_SERVICE_ROLE_KEY` (secret key — server only), `AUTH_PROVIDER=supabase`, `STORAGE_PROVIDER=supabase`, strong `JWT_SECRET`, `COOKIE_SECURE=true` (and `COOKIE_SAMESITE=none` + HTTPS if the API is on a different site than the frontends), real email provider, `PAYMENT_PROVIDERS` without `mock`.

`GET /health` → `{ status, environment, timestamp, checks: { database } }` (503 when the database is unreachable).
