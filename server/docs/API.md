# SPORTX API — endpoint reference

This reference is written from the code (`src/modules/*/*.routes.ts`, `*.schema.ts`, mappers and services). [`ROUTES.md`](ROUTES.md) lists every method and path. [`openapi.yaml`](openapi.yaml) is the machine-readable version (OpenAPI 3.0.3). For setup and architecture, see the [README](../README.md).

## Contents

1. [Conventions](#1-conventions): base URL, envelope, pagination, errors, authentication, idempotency, rate limits
2. [Auth](#2-auth)
3. [Store & shipping](#3-store--shipping)
4. [Catalog (public)](#4-catalog-public)
5. [Cart](#5-cart)
6. [Wishlist](#6-wishlist)
7. [Checkout](#7-checkout)
8. [Orders](#8-orders)
9. [Payments & webhooks](#9-payments--webhooks)
10. [Coupons](#10-coupons)
11. [Reviews](#11-reviews)
12. [Addresses](#12-addresses)
13. [Users / account](#13-users--account)
14. [Notifications](#14-notifications)
15. [Support](#15-support)
16. [Newsletter / contact](#16-newsletter--contact)
17. [Admin](#17-admin): auth, dashboard, reports, products, categories, brands, inventory, orders, customers, reviews, coupons, discounts, flash sales, campaigns, support, notifications, settings, shipping, payment settings, staff, roles, activity, search

---

## 1. Conventions

### Base URL

Every path in this document is relative to **`/api/v1`**. For example, `GET /products` means `GET http://localhost:4000/api/v1/products`. There is one exception: `GET /health` is served at the server root.

- Bodies are JSON (`Content-Type: application/json`, 1 MB max). The exceptions are image uploads (`multipart/form-data`, field `file`) and payment webhooks (raw body).
- Money is always an **integer in DJF**.
- Dates are ISO-8601 strings in UTC.
- Unknown body keys are silently dropped by Zod.
- CORS is restricted to an allow-list (`FRONTEND_URL`, `ADMIN_FRONTEND_URL`, `CORS_EXTRA_ORIGINS`) and sends credentials.
- Allowed request headers: `Content-Type`, `Authorization`, `Idempotency-Key`, `X-Request-Id`.
- Every response carries an `X-Request-Id` header. The server keeps a well-formed incoming id; otherwise it generates one.

### Response envelope

```jsonc
// success (ok / created → 200 / 201)
{ "success": true, "data": { … }, "message": "optional human text" }

// paginated list
{ "success": true, "data": [ … ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3, "hasNext": true, "hasPrevious": false },
  /* some lists add siblings: "facets", "counts", "summary", "unreadCount", "query" */ }

// action without payload (deletes, sign-out, …)
{ "success": true, "data": null, "message": "Done." }

// error
{ "success": false, "error": { "code": "OUT_OF_STOCK", "message": "Only 1 left of …", "details": { … }, "requestId": "…" } }
```

### Pagination

- **Query:** `page` (≥ 1, max 10 000, default 1) and `limit`. The `limit` default and maximum differ per endpoint and are listed in each section. Admin lists use 20 / 100.
- **Response meta:** `page`, `limit`, `total`, `totalPages` (≥ 1), `hasNext`, `hasPrevious`.

**Standard admin list query (`adminListQuery`)**

| Param | Rule |
| --- | --- |
| `page` | Standard, see above |
| `limit` | Default 20, max 100 |
| `search` | ≤ 120 characters |
| `date_from`, `date_to` | ISO date-time or `YYYY-MM-DD`. A date-only `date_to` is inclusive to the end of that day. |
| `sort` | Whitelisted per endpoint |
| `order` | `asc` \| `desc` (default `desc`) |

When a section says **"std list"**, it means this query.

### Error codes

| Code | HTTP | Typical cause |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Zod validation failed. `details` holds `{ body?/query?/params?: { formErrors, fieldErrors } }`. Also: malformed JSON, business-rule field errors, Postgres check or format errors. |
| `UNAUTHORIZED` | 401 | Token missing, invalid or expired. Expired tokens return `details.reason = "token_expired"`. Also: wrong credentials, or a refresh session that is missing or expired. |
| `PAYMENT_FAILED` | 402 | The payment method is not available, or the provider rejected a payment or refund |
| `FORBIDDEN` | 403 | A permission is missing, a staff-only rule applies, or a non-admin token was used on an admin API |
| `ACCOUNT_INACTIVE` | 403 | The account is `INACTIVE` or `BLOCKED`. Checked on every authenticated request. |
| `EMAIL_NOT_VERIFIED` | 403 | Customer login while `EMAIL_VERIFICATION_REQUIRED=true` and the email is not verified |
| `NOT_FOUND` | 404 | Unknown resource, or another user's record (ownership returns 404, never 403). Unknown routes also return 404. |
| `CONFLICT` | 409 | Duplicate record, or a state that forbids the action. A unique-constraint violation (`details.constraint`) and a referenced FK also map here. |
| `OUT_OF_STOCK` | 409 | Not enough available stock. `details.available` and/or `details.issues` explain it. |
| `PAYLOAD_TOO_LARGE` | 413 | JSON body over 1 MB, or upload over `UPLOAD_MAX_BYTES` |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Upload is not JPEG, PNG, WebP or AVIF (checked by MIME type, then by magic bytes) |
| `INVALID_COUPON` | 422 | The coupon code is not applicable |
| `ORDER_INVALID` | 422 | Illegal order state transition, empty bag, unavailable item or shipping method, or nothing refundable |
| `RATE_LIMITED` | 429 | A rate limiter was hit (see below) |
| `INTERNAL_ERROR` | 500 | Unexpected error. No details are exposed. |

The error lists in the tables below give **specific** codes only. Every endpoint can also return `VALIDATION_ERROR` (when it takes input) and `RATE_LIMITED`. Authenticated endpoints can also return `UNAUTHORIZED` and `ACCOUNT_INACTIVE`. Admin endpoints can also return `FORBIDDEN`.

### Authentication

**Access token**

- A JWT (HS256) valid for about 15 minutes (`ACCESS_TOKEN_TTL_SECONDS`).
- Send it as `Authorization: Bearer <token>`.
- The response body returns it as `accessToken` plus `expiresAt`.
- Tokens are scoped:
  - `customer` tokens come from `/auth/*`.
  - `admin` tokens come from `/admin/auth/*`.

**Refresh token**

- An opaque token, stored hashed in the database.
- It is sent **only** as an HttpOnly cookie:
  - `sportx_rt` for the storefront.
  - `sportx_admin_rt` for the admin.
  - Cookie settings: path `/api/v1`, `Secure` and `SameSite` from env.
- `POST /auth/refresh` (or `/admin/auth/refresh`) rotates it on every call.
- Replaying a token that was already rotated revokes **all** of the user's sessions.
- `remember: false` at login sets a session cookie instead of a persistent one.

**Authorization levels used in the tables**

| Level | Meaning |
| --- | --- |
| public | No token needed |
| optional | A token is used when present |
| customer | Any valid access token of an **ACTIVE** account. Admin-scoped tokens are also accepted here. |
| admin | Admin-scoped token **and** a staff role (`requireAdmin`), plus the listed `permission`. "any staff" means no extra permission is needed. |

- Identity always comes from the token. User ids in URLs or bodies are never trusted for ownership.
- Roles and permissions are loaded server-side and cached for up to 15 s per user. Role and status changes invalidate the cache.

### Idempotency keys

`Idempotency-Key: <8–128 of A-Z a-z 0-9 _ ->` is honoured on these endpoints:

| Endpoint | Effect of a replayed key |
| --- | --- |
| `POST /orders` | Returns the original order with **200** "Order already placed." instead of creating a new one (201) |
| `POST /payments/create` | The key is scoped to the order and forwarded to the provider, so the provider de-duplicates retries |
| `POST /admin/orders/:id/refund` | Replays the same refund instead of issuing a second one |

A malformed key is **ignored silently**, which is the same as sending no key.

### Rate limits

Limits are per IP, use in-memory stores, and send `RateLimit` / `RateLimit-Policy` headers (draft-7). They are disabled in tests.

| Group | Window / limit | Applied to |
| --- | --- | --- |
| general | 300 / min | Everything under `/api/v1` (webhooks excluded) |
| auth | 20 / 15 min | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/verify-email`, `/admin/auth/login`, `/admin/auth/refresh`, `PATCH /users/me/password`, `DELETE /users/me` |
| pwreset | 5 / hour | `/auth/forgot-password`, `/auth/reset-password`, `/auth/resend-verification`, `/admin/auth/forgot-password`, `/admin/auth/reset-password` |
| coupon | 20 / min | `POST /cart/coupon`, `POST /coupons/validate` |
| payment | 15 / min | `POST /payments/create` |
| review | 10 / hour | `POST /products/:id/reviews` |
| write | 60 / min | Cart item writes, cart merge, wishlist add/merge, address create/update, profile update/avatar, `POST /orders`, ticket create/reply, review edit, admin product create, image, logo and category-image uploads |
| form | 10 / hour | `POST /newsletter` and `POST /contact`. The two share **one** bucket. |

### Common shapes

The full schemas are in `openapi.yaml` under `components/schemas`.

- **User**
  - `{ id, firstName, lastName, email, phone ('' if none), avatarUrl, status, marketingOptIn, emailVerified, lastLoginAt, createdAt }`
- **ProductSummary**
  - Identity and taxonomy: `{ id, slug, name, brand{name,slug}, category{slug,name}, department, sport, gender[], shortDescription }`
  - Pricing: `price` (effective, after promotions), `originalPrice`, `compareAtPrice`, `isSale`, `discountPercent`
  - Media and variants: `image`, `hoverImage`, `colors[{name,hex}]`, `sizes[]`
  - Merchandising: `rating`, `reviewCount`, `badge`, `isNew`, `isFeatured`, `isBestSeller`, `popularity`
  - Stock and dates: `stockStatus` (IN_STOCK|LOW_STOCK|OUT_OF_STOCK), `available`, `createdAt`
- **Cart**
  - `{ id, currency, items[], issues[], coupon, totals }`
  - Each item: `{ id (cart line id), productId, variantId, slug, name, brand, image, sku, color, colorHex, size, quantity, unitPrice, originalUnitPrice, compareAtPrice, unitDiscount, lineTotal, available, maxStock, appliedDiscount, status, addedAt }`
  - Item `status` is `OK` or the blocking issue: `UNAVAILABLE`, `INACTIVE` or `OUT_OF_STOCK`.
- **PriceTotals**
  - `{ itemCount, subtotal, productDiscount, merchandiseTotal, couponDiscount, shipping, tax, taxInclusive, grandTotal, savings, freeShippingThreshold, freeShippingRemaining }`
- **OrderSummary**
  - `{ id, orderNumber, status, paymentStatus, paymentMethod, shippingStatus, customer{id,firstName,lastName,email,phone}, itemsCount, currency, grandTotal, refundedTotal, shippingMethod, image, placedAt, updatedAt }`
- **Order** (detail) extends OrderSummary with:
  - Common fields: `items[]`, `totals{subtotal, productDiscount, couponCode, couponDiscount, shipping, tax, grandTotal, refunded, net}`, `shipping{methodCode, methodName, carrier, trackingNumber, status, cost, estimatedDeliveryAt, shippedAt, deliveredAt, address}`, `payment`, `timeline[]`, `refunds[]`, `customerNote`, `paymentExpiresAt`, `cancelledAt`, `cancelReason`, `createdAt`
  - Customer view only: `canCancel`
  - Admin view only: `events[]`, `allowedTransitions[]`, `inventoryState`, plus `providerPaymentId`, refund internals and timeline notes
- **Address**
  - `{ id, label, firstName, lastName, fullName, phone, addressLine1, addressLine2, line1, line2, district, city, country, postalCode, isDefault, createdAt, updatedAt }`
  - `line1` and `line2` are storefront aliases of `addressLine1` and `addressLine2`.
- **Notification**
  - `{ id, type, title, message, link, data, read, readAt, createdAt }`

**Enums**

| Enum | Values |
| --- | --- |
| Order status | `PENDING`, `PAYMENT_PENDING`, `PAYMENT_CONFIRMED`, `PROCESSING`, `PACKED`, `SHIPPED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`, `REFUND_REQUESTED`, `REFUNDED` |
| Payment status | `PENDING`, `AUTHORIZED`, `PAID`, `FAILED`, `PARTIALLY_REFUNDED`, `REFUNDED`, `CANCELLED` |
| Payment method | `CARD`, `MOBILE_MONEY`, `CASH_ON_DELIVERY`, `BANK_TRANSFER` |
| Shipping status | `PENDING`, `PACKED`, `SHIPPED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RETURNED` |

---

## System

| Method | Path | Auth | Response |
| --- | --- | --- | --- |
| GET | `/health` (server root, **not** under /api/v1) | public | `{ status: ok\|degraded, environment, timestamp, checks: { database: up\|down } }` |

- Returns 200 when the database is up and **503** when it is down.
- Not rate limited and not logged.

## 2. Auth

The customer app uses `/auth`. The storefront refresh cookie is `sportx_rt`.

| Method | Path | Auth | Body | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/auth/register` | public · auth limit | `firstName`* (1–80), `lastName`* (1–80), `email`* (≤ 254, lower-cased), `phone` (`^\+?[0-9\s-]{7,20}$` or `''`), `password`* (8–128, a letter and a digit), `marketingOptIn` (bool, default false) | **201**. See the note below. | CONFLICT (email taken) |
| POST | `/auth/login` | public · auth limit | `email`*, `password`* (1–128), `remember` (default true) | `{ user, accessToken, expiresAt }` and sets the cookie | UNAUTHORIZED ("Incorrect email or password.", same message for an unknown email), ACCOUNT_INACTIVE, EMAIL_NOT_VERIFIED |
| POST | `/auth/refresh` | cookie `sportx_rt` · auth limit | none | `{ user, accessToken, expiresAt }` and a rotated cookie | UNAUTHORIZED ("No active session." or "Session expired…") |
| POST | `/auth/logout` | cookie (optional) | none | `data: null`. Revokes the session and clears the cookie. | none |
| POST | `/auth/forgot-password` | public · pwreset | `email`* | `data: null`. Always 200, so account existence is not revealed. | none |
| POST | `/auth/reset-password` | public · pwreset | `token`* (10–4096), `password`* (rule above) | `data: null`. Revokes every session. | UNAUTHORIZED (bad or expired token) |
| POST | `/auth/verify-email` | public · auth limit | `token`* | `{ user }` | UNAUTHORIZED |
| POST | `/auth/resend-verification` | public · pwreset | `email`* | `data: null` (always) | none |
| GET | `/auth/me` | customer | none | `{ user }` | UNAUTHORIZED |

Register response:
- When no email verification is needed, the response is `{ user, accessToken, expiresAt, requiresEmailVerification: false }` and the refresh cookie is set.
- Otherwise it is `{ user, requiresEmailVerification: true }`.

`*` = required.

## 3. Store & shipping

| Method | Path | Auth | Input | Response |
| --- | --- | --- | --- | --- |
| GET | `/store` | public | none | `{ storeName, tagline, supportEmail, phone, address[], country, currency, timezone, logoUrl, taxRate, taxInclusive, freeShippingThreshold, maxQuantityPerLine }` |
| GET | `/shipping/methods` | public | none | `{ freeShippingThreshold, currency, methods[{ id, code, name, description, price, freeShippingThreshold, minDays, maxDays, requiresAddress, carrier }] }`. Only active methods of active zones are listed. |
| POST | `/shipping/estimate` | optional | `city` (≤ 80), `merchandiseTotal` (int 0–100 000 000) | `{ merchandiseTotal, options[ShippingQuote + description, requiresAddress, carrier] }` |

- A ShippingQuote is `{ methodId, code, name, fee, isFree, estimatedDelivery{minDays,maxDays,earliest,latest} }`.
- For `POST /shipping/estimate`: when the caller is signed in and has a non-empty cart, the quote uses that cart's merchandise total minus the coupon. The body's `merchandiseTotal` is then ignored.
- Methods with regions only match when the `city` matches one of them, unless the method does not require an address.

## 4. Catalog (public)

`:idOrSlug` accepts a product UUID or slug. Only `PUBLISHED`, non-deleted products are visible, and anything else returns `NOT_FOUND`.

| Method | Path | Query | Response | Errors |
| --- | --- | --- | --- | --- |
| GET | `/products` | See the list query below | Paginated `ProductSummary[]` plus a sibling `facets` object | none |
| GET | `/products/search` | Same as `/products`. **`q` is required.** | Same as `/products`, plus a sibling `query` | VALIDATION_ERROR ("Enter a search term.") |
| GET | `/products/featured` | `kind`: new \| bestseller \| sale \| training \| football \| basketball \| running \| featured (default); `limit` 1–48 (default 8) | `ProductSummary[]`. Cached for 60 s. | none |
| GET | `/products/batch` | `ids`, `slugs`: comma lists or repeated params, ≤ 60 in total | `ProductSummary[]` in request order. Unknown or unpublished items are skipped. | VALIDATION_ERROR (> 60) |
| GET | `/products/:idOrSlug` | none | **ProductDetail** (see below) | NOT_FOUND |
| GET | `/products/:idOrSlug/related` | `limit` 1–24 (default 8) | `ProductSummary[]` | NOT_FOUND |
| GET | `/products/:idOrSlug/complete-the-look` | `limit` 1–24 (default 4) | `ProductSummary[]`. Curated items come first, then other departments of the same sport. | NOT_FOUND |
| GET | `/products/:id/reviews` | `page`; `limit` 1–50 (default 10); `sort` newest (default) \| highest \| lowest \| helpful; `rating` 1–5 | See below | NOT_FOUND |
| POST | `/products/:id/reviews` | See [Reviews](#11-reviews) | | |
| GET | `/categories` | none | Tree of active categories. Each node: `{ id, name, slug, description, imageUrl, parentId, sortOrder, productCount, seoTitle, seoDescription, children[] }`. Cached for 120 s. | none |
| GET | `/categories/:slug` | none | The node plus `breadcrumb[{id,name,slug}]` | NOT_FOUND |
| GET | `/brands` | none | Active brands: `[{ id, name, slug, description, logoUrl, website, productCount }]`. Cached for 120 s. | none |
| GET | `/brands/:slug` | none | Brand | NOT_FOUND |

**`/products` list query**

| Param | Rule |
| --- | --- |
| `page` | Standard |
| `limit` | 1–48, default 12. `pageSize` is an alias. |
| `q` | ≤ 120 characters |
| `collection` | shop, men, women, kids, football, basketball, running, training, equipment, new-arrivals, sale, footwear, apparel, accessories, balls, bags, gym-equipment |
| `category`, `brand`, `gender`, `sport`, `size`, `color` | Comma lists or repeated params. The plural forms (`categories`, `brands`, …) are also accepted. |
| `minPrice`, `maxPrice` | Integers |
| `minRating` | 0–5 |
| `inStock` / `inStockOnly` | Booleans |
| `availability` | in_stock \| out_of_stock \| all |
| `sale`, `new` | Booleans |
| `sort` | featured \| newest \| price_asc \| price_desc \| rating \| popular \| relevance. The `price-asc` spelling is also accepted. |

- The `/products` list is cached for 30 s (`Cache-Control: public, max-age=30`).
- The `facets` object is `{ categories, brands, sizes, colors, genders, sports: [{ value, label, count, hex? }], priceRange: { min, max } }`.

**ProductDetail**

The full PDP payload comes in one response:
- Identity and taxonomy: `id, slug, name, sku, brand{id,name,slug}, category{id,name,slug,parent}, department, sport, gender[], productType, shortDescription, description`
- Media and variants: `images[{id,url,alt,role,color,position}], colors[{name,hex,imageIndex?}], sizes[], variants[{id,sku,color,colorHex,size,price,originalPrice,compareAtPrice,available,stock,stockStatus}]`
- Stock: `stock, available, stockStatus`
- Pricing: `price, originalPrice, compareAtPrice, salePrice, isSale, discountPercent, appliedPromotion{source,id,name}|null, pricing{…,currency}`
- Reviews: `rating, reviewCount, ratingDistribution{'1'..'5'}`
- Merchandising: `features[], specifications[{label,value}], badge, isNew, isFeatured, isBestSeller, popularity, sizeGuide, tags[], seo{title,description}`
- Shipping: `shipping{freeShippingThreshold,currency,methods[]}`
- Related products: `completeTheLook[ProductSummary], related[ProductSummary]`
- Dates: `publishedAt, createdAt, updatedAt`

Viewing a product detail increments its view counter.

**Product reviews response**

- Shape: `{ productId, reviews[Review], summary{ average, total, distribution{1..5} }, pagination }`.
- Only approved reviews are included.
- Pagination sits inside `data`, not in the paginated envelope.
- A Review is `{ id, productId, author ("Hodan A."), rating, title, comment, body, fit, size, verifiedPurchase, verified, helpfulCount, createdAt }`.

## 5. Cart

All cart endpoints require **customer** auth. Every endpoint returns the **full Cart**, priced on the server by `priceCart`. Client prices are never accepted.

| Method | Path | Body | Notes | Errors |
| --- | --- | --- | --- | --- |
| GET | `/cart` | none | Creates nothing. Returns an empty cart (`id: null`) if there is none. | none |
| POST | `/cart/items` | `variantId`* (uuid), `quantity` (int 1–100, default 1) | Adds to an existing line. Capped by the store's `maxQuantityPerLine` (≤ 10). Write limit. Message: "Added to your bag." | NOT_FOUND (unsellable variant), OUT_OF_STOCK (`details.available`, `inCart`), VALIDATION_ERROR (per-line max, `details.max`) |
| PATCH | `/cart/items/:id` | `quantity`* (int 0–100; **0 removes the line**) | `:id` is the cart **line** id. Write limit. | NOT_FOUND, ORDER_INVALID (item no longer sellable), OUT_OF_STOCK, VALIDATION_ERROR (max) |
| DELETE | `/cart/items/:id` | none | Removes the line | NOT_FOUND |
| DELETE | `/cart` | none | Empties the cart and clears the coupon | none |
| POST | `/cart/merge` | `items`* `[{ variantId, quantity 1–100 }]` (≤ 50) | Guest bag after sign-in. See below. Write limit. | none |
| POST | `/cart/coupon` | `code`* (1–40, upper-cased) | Validated against the priced cart and stored only when valid. Coupon limit. | INVALID_COUPON (empty bag or invalid code, `details.code`) |
| DELETE | `/cart/coupon` | none | Removes the coupon | none |

- Cart `issues[]` is `{ itemId, variantId, type: UNAVAILABLE|INACTIVE|OUT_OF_STOCK|INSUFFICIENT_STOCK|QUANTITY_LIMIT|PRICE_CHANGED, message, available?, newUnitPrice? }`.
- Cart `coupon` is `{ code, valid, message, discount, type?, value?, description? } | null`.
- For `/cart/merge`: the larger quantity wins for each variant. Problems do not cause errors; they are reported in `mergeIssues[{ variantId, type: UNAVAILABLE|OUT_OF_STOCK|QUANTITY_REDUCED, message, requested?, quantity? }]`.

## 6. Wishlist

All wishlist endpoints require **customer** auth. `:productId` is a product UUID or slug (`^[A-Za-z0-9-]{1,200}$`). Responses are `{ ids[], count, items[{ productId, addedAt, product{ id, name, slug, brand, brandSlug, image, hoverImage, price, compareAtPrice, rating, reviewCount, badge, isNew, inStock, colors[] } }] }`.

| Method | Path | Body | Response | Errors |
| --- | --- | --- | --- | --- |
| GET | `/wishlist` | none | Wishlist | none |
| POST | `/wishlist/merge` | `productIds`* (≤ 200 references) | Wishlist. Write limit. | none |
| GET | `/wishlist/check/:productId` | none | `{ inWishlist }` | none |
| POST | `/wishlist/:productId` | none | Wishlist. Idempotent. Only published products can be added. Maximum 200 items. Write limit. | NOT_FOUND, CONFLICT (full) |
| DELETE | `/wishlist/:productId` | none | Wishlist. Idempotent; also removes unpublished products. | none |

## 7. Checkout

| Method | Path | Auth | Body | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/checkout/validate` | customer | See the body fields below | See the response below | NOT_FOUND (addressId) |

**Body fields**

| Field | Rule |
| --- | --- |
| `shippingMethod` | Code or id, 2–40 characters |
| `couponCode` | ≤ 32 characters. Omitted means the cart's coupon is used; `null` means no coupon. |
| `addressId` | uuid |
| `address` | A partial OrderAddress |
| `paymentMethod` | CARD \| MOBILE_MONEY \| CASH_ON_DELIVERY \| BANK_TRANSFER |

**Response**

- `{ valid, problems[{field,message}], currency, lines[PricedLine], issues[], coupon, shipping (ShippingQuote|null), totals, shippingOptions[], paymentMethods[{method,provider,label}] }`
- Problems are reported with `valid: false`, **not** as errors.
- `valid` is true only when all of these hold:
  - there are no problems,
  - there are no issues other than `PRICE_CHANGED`,
  - the coupon is valid (or absent),
  - a shipping method was resolved.

## 8. Orders

Orders endpoints require **customer** auth and only return the caller's own orders.

| Method | Path | Input | Response | Errors |
| --- | --- | --- | --- | --- |
| POST | `/orders` | Header `Idempotency-Key` (optional). Body fields below. | **201** `Order` ("Order placed."), or **200** when the key is replayed ("Order already placed."). Write limit. | See below |
| GET | `/orders` | `page`; `limit` 1–50 (default 10); `status` active \| delivered \| cancelled \| all (default) | Paginated `OrderSummary[]`, newest first | none |
| GET | `/orders/:id` | `:id` is an order **UUID or order number** | `Order` (customer view) | NOT_FOUND |
| POST | `/orders/:id/cancel` | `reason` (≤ 300, nullable) | `Order` | NOT_FOUND, ORDER_INVALID (already being prepared), PAYMENT_FAILED (automatic refund failed) |

**`POST /orders` body**

| Field | Rule |
| --- | --- |
| `shippingMethod`* | Code or id, 2–40 characters |
| `paymentMethod`* | Payment method enum |
| `addressId` | uuid. Use **either** `addressId` **or** `address`. |
| `address` | OrderAddress: `firstName`*, `lastName`*, `phone`*, `addressLine1`* (3–200), `addressLine2`, `district`, `city`* (2–80), `country` (default Djibouti), `postalCode` |
| `couponCode` | ≤ 32 characters, nullable. Omitted means the cart's coupon is used. |
| `customerNote` | ≤ 500 characters |

**`POST /orders` errors**

| Code | When |
| --- | --- |
| FORBIDDEN | The account cannot place orders |
| ORDER_INVALID | Empty bag, unavailable method or item |
| VALIDATION_ERROR | An address is required for this method |
| NOT_FOUND | The address was not found |
| OUT_OF_STOCK | Not enough stock (`details.issues`) |
| INVALID_COUPON | The coupon is not valid, including when its usage limit is reached |
| PAYMENT_FAILED | The payment method is unavailable |
| CONFLICT | A unique-constraint violation |

**How an order is placed**

- The order is created in a single transaction:
  1. Price the server cart.
  2. Reserve stock atomically.
  3. Write the order and item snapshots.
  4. Create the shipping and payment records.
  5. Record coupon usage.
  6. Clear the cart.
- The resulting status depends on the payment method:
  - Online methods start as `PAYMENT_PENDING` with a `paymentExpiresAt`. Unpaid orders expire after the store's `pendingPaymentTtlMinutes` and release their stock.
  - Cash on delivery, bank transfer and free orders start as `PENDING`.

**Cancelling**

- Customers can cancel while the order is `PENDING`, `PAYMENT_PENDING` or `PAYMENT_CONFIRMED`.
- Paid orders are refunded automatically on cancellation.

**Order state machine** (staff can set the statuses marked with ✱)

| From | Allowed to |
| --- | --- |
| PENDING | PAYMENT_CONFIRMED, PROCESSING✱, CANCELLED✱ |
| PAYMENT_PENDING | PAYMENT_CONFIRMED, CANCELLED✱ |
| PAYMENT_CONFIRMED | PROCESSING✱, CANCELLED✱, REFUND_REQUESTED✱ |
| PROCESSING | PACKED✱, CANCELLED✱, REFUND_REQUESTED✱ |
| PACKED | SHIPPED✱, PROCESSING✱, CANCELLED✱ |
| SHIPPED | OUT_FOR_DELIVERY✱, DELIVERED✱ |
| OUT_FOR_DELIVERY | DELIVERED✱ |
| DELIVERED | REFUND_REQUESTED✱, REFUNDED |
| REFUND_REQUESTED | REFUNDED, DELIVERED✱, PROCESSING✱ |

- `PAYMENT_CONFIRMED` comes only from payments (a verified webhook, or an offline payment marked paid).
- `REFUNDED` comes only from the refund workflow.

## 9. Payments & webhooks

| Method | Path | Auth | Input | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/payments/methods` | public | none | `[{ method, provider, label }]` for the enabled providers | none |
| POST | `/payments/create` | customer · payment limit | `orderId`* (uuid). Header `Idempotency-Key` (optional). | **201** `{ payment, clientSecret, redirectUrl, provider }` | NOT_FOUND, CONFLICT (already paid), ORDER_INVALID (order is not `PAYMENT_PENDING`, or is cancelled), PAYMENT_FAILED (method unavailable) |
| GET | `/payments/:id` | customer | none | `Payment` | NOT_FOUND (also for another user's payment) |
| POST | `/payments/webhook/:provider?` | provider signature | Raw body (≤ 1 MB, any content type) | `{ success, data: { received: true, outcome: processed\|duplicate\|ignored } }` | 400 VALIDATION_ERROR ("Invalid signature."), 404 unknown webhook provider, 500 processing failed (the provider retries) |
| POST | `/payments/:id/mock-complete` | customer · **dev only** | `outcome` succeeded (default) \| failed; `last4` (4 digits) | `{ outcome, payment }` | NOT_FOUND, VALIDATION_ERROR (not a mock payment) |

**`/payments/create`**

- `clientSecret` is the Stripe PaymentIntent client secret, used with Stripe.js.
- The endpoint reuses the order's open `PENDING` payment row, or adds a new attempt.

**Payment**

- Shape: `{ id, orderId, provider, method, status, amount, refundedAmount, currency, cardBrand, cardLast4, failureReason, paidAt, createdAt }`.
- No card data is ever stored.

**Webhooks**

- `:provider` defaults to `stripe` when it is omitted, so `POST /payments/webhook` is Stripe's endpoint.
- The route is mounted **before** the JSON parser and **outside** the general rate limiter.
- The signature is verified by the provider (`Stripe-Signature` for Stripe).
- Events are de-duplicated on `(provider, event_id)`.
- Only a verified webhook marks an online payment as paid.

**Mock completion** (`/payments/:id/mock-complete`)

- The route exists only when `NODE_ENV≠production` **and** the `mock` provider is enabled.
- It sends a correctly signed mock webhook through the real pipeline.
- It is **not** in ROUTES.md.

## 10. Coupons

| Method | Path | Auth | Body | Response |
| --- | --- | --- | --- | --- |
| POST | `/coupons/validate` | customer · coupon limit | `code`* (1–40, upper-cased), `subtotal` (int, used **only** when the server cart is empty) | `{ valid, code, discount, message, type, value, description, basedOn: cart\|subtotal }` |

- This endpoint only previews a code; it does not apply it. To apply a code, use `POST /cart/coupon`.
- An invalid code returns **200 with `valid: false`**, not an error.
- Coupon rules checked:
  - active window, total usage limit and per-customer limit,
  - minimum order and maximum discount,
  - product, category and customer-group restrictions.

## 11. Reviews

| Method | Path | Auth | Body | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/products/:id/reviews` | customer · review limit | See body below | **201** `OwnReview` (status `PENDING`) | NOT_FOUND (product), FORBIDDEN ("You can review products you have received."), CONFLICT (already reviewed) |
| GET | `/reviews/mine` | customer | none | `OwnReview[]`. An OwnReview is a Review plus `status`, `product{id,name,slug,image}` and `updatedAt`. | none |
| PATCH | `/reviews/:id` | customer · write limit | Any subset of the create fields, at least one | `OwnReview`. The review **goes back to PENDING**. | NOT_FOUND |
| DELETE | `/reviews/:id` | customer | none | `data: null` (soft delete) | NOT_FOUND |

**Create body**

| Field | Rule |
| --- | --- |
| `rating`* | 1–5 |
| `title`* | 2–120 characters |
| `comment`* | 10–2000 characters. `body` is accepted as an alias. |
| `fit` | small \| true \| large |
| `size` | ≤ 20 characters |

- `:id` accepts a product UUID or slug.
- Only customers with a **DELIVERED** order containing the product can review it, and only once.

## 12. Addresses

All address endpoints require **customer** auth. Another user's address returns 404. The response is `Address`.

| Method | Path | Body | Response | Errors |
| --- | --- | --- | --- | --- |
| GET | `/addresses` | none | `Address[]` | none |
| POST | `/addresses` | See the fields below. Write limit. | **201** `Address` | CONFLICT (max 20 addresses) |
| GET | `/addresses/:id` | none | `Address` | NOT_FOUND |
| PATCH | `/addresses/:id` | Any subset of the fields, at least one. Write limit. | `Address` | NOT_FOUND |
| PATCH | `/addresses/:id/default` | none | `Address` | NOT_FOUND |
| DELETE | `/addresses/:id` | none | `data: null` | NOT_FOUND |

**Fields**

| Field | Rule |
| --- | --- |
| `label` | 1–40 characters, default "Home" |
| `firstName`*, `lastName`* | 1–80 characters |
| `phone`* | Phone pattern |
| `addressLine1`* | 3–200 characters. `line1` is accepted as an alias. |
| `addressLine2` | ≤ 200 characters. `line2` is accepted as an alias. |
| `district` | ≤ 80 characters |
| `city`* | 2–80 characters |
| `country` | Default "Djibouti" |
| `postalCode` | ≤ 20 characters |
| `isDefault` | Default false |

## 13. Users / account

All endpoints below require **customer** auth.

| Method | Path | Body | Response | Errors |
| --- | --- | --- | --- | --- |
| GET | `/users/me` | none | `{ user }` | none |
| PATCH | `/users/me` | `firstName`, `lastName`, `phone` (nullable/''), `marketingOptIn`, `email`, `currentPassword`. Needs at least one field other than `currentPassword`. Write limit. | `{ user }` | VALIDATION_ERROR (current password missing or wrong, `fieldErrors.currentPassword`), CONFLICT (email already used) |
| POST | `/users/me/avatar` | multipart `file` (JPEG/PNG/WebP/AVIF) | `{ user }`. Write limit. | VALIDATION_ERROR (no file), PAYLOAD_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE |
| DELETE | `/users/me/avatar` | none | `{ user }` | none |
| PATCH | `/users/me/password` | `currentPassword`*, `newPassword`* (password rule; must differ from the current one) | `data: null`. Signs out all **other** sessions. Auth limit. | VALIDATION_ERROR |
| DELETE | `/users/me` | `password`* | `data: null`. Clears the cookie. Auth limit. | VALIDATION_ERROR (wrong password), CONFLICT (orders still in progress, `details.openOrders`) |
| GET | `/account/dashboard` | none | `{ user, orderCounts{total,active,pending,delivered,cancelled}, recentOrders[5], wishlistCount, addressesCount, defaultAddress, unreadNotifications, recentNotifications[5], openTickets, reviewsCount }` | none |

- Changing `email` on `PATCH /users/me`:
  - requires `currentPassword`;
  - when verification is enabled, the email must be verified again.
- `DELETE /users/me`:
  - anonymises and soft-deletes the profile;
  - deletes addresses, cart, wishlist and the newsletter subscription;
  - revokes all sessions;
  - keeps orders.

## 14. Notifications

The same handlers serve the customer centre (`/notifications`, **customer**, own notifications only) and the shared staff centre (`/admin/notifications`, see [Admin: notifications](#admin-notifications)).

| Method | Path | Input | Response | Errors |
| --- | --- | --- | --- | --- |
| GET | `/notifications` | `page`; `limit` (default 20, max 100); `unread` (true/false/1/0); `type` (NotificationType, case-insensitive) | Paginated `Notification[]` plus a sibling `unreadCount` | none |
| GET | `/notifications/unread-count` | none | `{ unreadCount }` | none |
| PATCH | `/notifications/read-all` | none | `{ updated, unreadCount: 0 }` | none |
| POST | `/notifications/read-all` | Alias of the PATCH above | same | none |
| PATCH | `/notifications` | `ids`* (uuid, 1–500), `read` (default true) | `{ updated, unreadCount }` | none |
| DELETE | `/notifications` | `ids`* (1–500) | `{ deleted, unreadCount }` | none |
| POST | `/notifications/delete` | Alias of `DELETE /notifications` (for clients that cannot send a DELETE body) | same | none |
| PATCH | `/notifications/:id/read` | none | `{ notification, unreadCount }` | NOT_FOUND |
| PATCH | `/notifications/:id/unread` | none | `{ notification, unreadCount }` | NOT_FOUND |
| DELETE | `/notifications/:id` | none | `{ unreadCount }` | NOT_FOUND |

NotificationType values: `ORDER_CREATED`, `PAYMENT_CONFIRMED`, `ORDER_PROCESSING`, `ORDER_SHIPPED`, `ORDER_DELIVERED`, `ORDER_CANCELLED`, `REFUND_PROCESSED`, `SUPPORT_REPLY`, `LOW_STOCK`, `NEW_ORDER`, `PAYMENT_FAILED`, `REFUND_REQUESTED`, `NEW_TICKET`, `NEW_CUSTOMER`, `REVIEW_PENDING`.

## 15. Support

All support endpoints require **customer** auth and only return the caller's own tickets. Internal staff notes are never returned.

| Method | Path | Input | Response | Errors |
| --- | --- | --- | --- | --- |
| GET | `/support/tickets` | `page`; `limit` (default 20, max 50); `status` (OPEN \| IN_PROGRESS \| WAITING_CUSTOMER \| RESOLVED \| CLOSED; spellings like `in-progress` are accepted) | Paginated `Ticket[]`, most recently updated first | none |
| POST | `/support/tickets` | See the body below. Write limit. | **201** `TicketDetail` | VALIDATION_ERROR (order not on this account, `fieldErrors.orderNumber`) |
| GET | `/support/tickets/:id` | none | `TicketDetail` | NOT_FOUND |
| POST | `/support/tickets/:id/messages` | `body`* (1–5000). Write limit. | `TicketDetail` | NOT_FOUND, CONFLICT (ticket closed) |

**Create body**

| Field | Rule |
| --- | --- |
| `subject`* | 3–160 characters |
| `category` | ORDER \| DELIVERY \| RETURNS \| PAYMENT \| PRODUCT \| ACCOUNT \| OTHER (default). `return` is accepted for RETURNS. |
| `orderNumber` | ≤ 40 characters |
| `message`* | 1–5000 characters |

- A **Ticket** is `{ id, number, subject, category, priority, status, orderId, orderNumber, messageCount, lastMessage{author: customer|support, preview, createdAt}|null, closedAt, createdAt, updatedAt }`.
- A **TicketDetail** adds `messages[{ id, author: customer|support, authorName, body, createdAt }]`.
- A customer reply reopens a `RESOLVED` or `WAITING_CUSTOMER` ticket (its status goes back to OPEN).

## 16. Newsletter / contact

Both endpoints are public and share **one** "form" limiter bucket (10 per hour per IP).

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/newsletter` | `email`* | `{ alreadySubscribed }` (200 in both cases) |
| POST | `/contact` | `name`* (2–120), `email`*, `phone` (phone pattern or ''), `subject` (≤ 160), `message`* (5–5000) | **201** `{ received: true }` |

Contact messages are stored in `contact_messages` for the team. The subject is prefixed to the message.

---

## 17. Admin

**Access**

- Every `/admin/*` route except `/admin/auth/*` requires an **admin-scoped** token **and** a staff role:
  - A customer token gets 403 "Sign in to the admin to use this API."
  - A non-staff account gets 403 "Staff access required."
- Each route then checks the listed permission and returns 403 "Missing permission: x:y." when it is missing.

**Permission keys** have the form `module:action`:

| Module | Actions | Covers |
| --- | --- | --- |
| `dashboard` | view, export | Dashboard |
| `products` | view, create, edit, delete, approve, export | Products, variants and images |
| `categories` | view, create, edit, delete | **Both categories and brands** |
| `inventory` | view, create, edit, approve, export | Inventory |
| `orders` | view, create, edit, delete, approve, export | Orders, payments and refunds |
| `customers` | view, create, edit, delete, export | Customers |
| `reviews` | view, edit, delete, approve | Review moderation |
| `discounts` | view, create, edit, delete, approve | Coupons, automatic discounts, flash sales and campaigns |
| `reports` | view, export | Reports |
| `support` | view, create, edit, delete | Support tickets |
| `settings` | view, create, edit, delete | Store settings, shipping, payment settings, staff, roles and activity |

**Aliases**

Some routes have alias paths so they match the paths the admin UI calls. Each alias has identical behaviour and permissions to the canonical route.

| Alias | Canonical |
| --- | --- |
| `/admin/admin-users*` | `/admin/staff*` |
| `/admin/activity*` | `/admin/activity-logs*` |
| `/admin/settings/shipping*` | `/admin/shipping*` |
| `/admin/settings/store` | `/admin/settings` |
| `/admin/reports/nav-counts` | `/admin/dashboard/nav-counts` |

Most `PATCH /:id` routes also accept `PUT`.

**Every alias route, expanded**

Each row below behaves exactly like the canonical route documented further down.

| Alias route(s) | Canonical route(s) |
| --- | --- |
| `GET /admin/admin-users`, `POST /admin/admin-users` | `GET /admin/staff`, `POST /admin/staff` |
| `GET /admin/admin-users/:id`, `PATCH /admin/admin-users/:id`, `PUT /admin/admin-users/:id` | `GET / PATCH / PUT /admin/staff/:id` |
| `PATCH /admin/admin-users/:id/status` | `PATCH /admin/staff/:id/status` |
| `POST /admin/admin-users/:id/reset-access` | `POST /admin/staff/:id/reset-access` |
| `GET /admin/activity`, `GET /admin/activity/filters` | `GET /admin/activity-logs`, `GET /admin/activity-logs/filters` |
| `GET /admin/settings/shipping`, `GET /admin/settings/shipping/zones` | `GET /admin/shipping`, `GET /admin/shipping/zones` |
| `POST /admin/settings/shipping/zones`; `PATCH`, `PUT`, `DELETE /admin/settings/shipping/zones/:id` | Same methods on `/admin/shipping/zones` and `/admin/shipping/zones/:id` |
| `POST /admin/settings/shipping/methods`; `PATCH`, `PUT`, `DELETE /admin/settings/shipping/methods/:id` | Same methods on `/admin/shipping/methods` and `/admin/shipping/methods/:id` |
| `PATCH /admin/settings/shipping/:id` | `PATCH /admin/shipping/:id` (updates a method) |
| `GET`, `PATCH`, `PUT /admin/settings/store` | `GET`, `PATCH`, `PUT /admin/settings` |
| `GET /admin/reports/nav-counts` | `GET /admin/dashboard/nav-counts` |
| `POST /admin/notifications/read-all`, `POST /notifications/read-all` | The `PATCH …/read-all` route of the same centre |
| `POST /admin/notifications/delete`, `POST /notifications/delete` | The `DELETE` bulk route of the same centre |
| `POST /admin/inventory/adjustments` (variantId in the body) | `POST /admin/inventory/:variantId/adjust` |

### Admin: auth

The admin refresh cookie is `sportx_admin_rt`.

| Method | Path | Auth | Body | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/admin/auth/login` | public · auth limit | `email`*, `password`*, `remember` (default true) | `{ user, roles[{id,slug,name}], permissions[], accessToken, expiresAt }` and sets the cookie | UNAUTHORIZED, ACCOUNT_INACTIVE, FORBIDDEN ("This account does not have admin access.") |
| POST | `/admin/auth/refresh` | cookie · auth limit | none | Same shape as login, with a rotated cookie | UNAUTHORIZED |
| POST | `/admin/auth/logout` | cookie | none | `data: null` | none |
| GET | `/admin/auth/me` | admin (any staff) | none | `{ user, roles[], permissions[] }` | none |
| POST | `/admin/auth/forgot-password` | public · pwreset | `email`* | `data: null`. Always 200; the email is sent only to active staff. | none |
| POST | `/admin/auth/reset-password` | public · pwreset | `token`*, `password`* | `data: null` | UNAUTHORIZED |

Admin logins are audited on both success and failure (`Admin signed in` / `Admin sign-in failed`).

### Admin: dashboard

| Method | Path | Permission | Query | Response |
| --- | --- | --- | --- | --- |
| GET | `/admin/dashboard` | `dashboard:view` | Range query (see below) | See below |
| GET | `/admin/dashboard/nav-counts` | any staff | none | `{ orders, lowStock, outOfStock, support, reviews, refunds }` (sidebar badges) |

**Range query**

| Param | Rule |
| --- | --- |
| `range` | today \| 7d \| 30d (default) \| 3m \| 12m \| custom |
| `from`, `to` | `YYYY-MM-DD`. `date_from` and `date_to` are aliases. |

A `custom` range needs both `from` and `to`, with `from` ≤ `to`; otherwise the request fails with VALIDATION_ERROR.

**Dashboard response**

- `range{preset,label,bucket,timezone,from,to,previousFrom,previousTo}`
- `sales{totalSales,todaySales,monthlySales,periodRevenue,previousPeriodRevenue,change,averageOrderValue}`
- `orders{total,periodOrders,previous,change,pending,completed,cancelled,refundRequests}`
- `customers{total,newInPeriod,previous,change}`
- `productsSold{value,previous,change}`
- `products{total,published,lowStockVariants,outOfStockVariants}`
- `supportOpen`, `reviewsPending`
- `recentOrders[OrderSummary]`, `topProducts[]`, `salesChart[]`, `salesByCategory[]`
- `kpis{revenue,orders,customers,productsSold: {value,previous,change,trend[]}}`

### Admin: reports

All reports require `reports:view`.

- Query: the range query plus `groupBy` (hour \| day \| week \| month) and `format` (json (default) \| csv).
- **`format=csv` additionally requires `reports:export`** (403 otherwise). A CSV response is a `text/csv` attachment, not the JSON envelope.

| Method | Path | Extra query | JSON response |
| --- | --- | --- | --- |
| GET | `/admin/reports/sales` | none | `{ range, totals{revenue, orders, aov, grossSales, discounts, productDiscounts, couponDiscounts, refunds, shipping, tax, netSales}, previous, change, series[{date,label,…totals}] }` |
| GET | `/admin/reports/products` | See below | `{ range, totals{products,unitsSold,revenue,views,conversion}, best[], worst[], items[], total }` |
| GET | `/admin/reports/customers` | none | `{ range, totals{totalCustomers,newCustomers,returningCustomers,buyers,repeatRate,averageSpend,ordersPerCustomer}, growth[], topCustomers[], byCity[], byGroup[] }` |
| GET | `/admin/reports/inventory` | `range` is optional (default 3m, weekly) | `{ range, totals{products,variants,units,reserved,lowStock,outOfStock,stockValue,inventoryValue,retailValue,variantsMissingCost}, aging[], movement[{date,label,inbound,outbound}], topStocked[], byStatus[] }` |
| GET | `/admin/reports/nav-counts` | none | Alias of `/admin/dashboard/nav-counts` (any staff) |

**`/admin/reports/products` query**

| Param | Rule |
| --- | --- |
| `category`, `brand` | uuid |
| `sport` | ≤ 40 characters |
| `search` | ≤ 120 characters |
| `status` | DRAFT \| PUBLISHED \| ARCHIVED |
| `sort` | revenue (default) \| units \| views \| conversion \| stock \| name \| trend |
| `order` | asc \| desc |
| `page` | Standard |
| `limit` | 1–100, default 50 |

- In the products report, `items[]` is `{ productId, name, sku, slug, status, productType, sport, category, brand, image, unitsSold, revenue, views, conversion, stock, previousUnits, trend }`.
- The products report uses a `total` field instead of the pagination envelope. Its CSV export contains all rows.
- The inventory CSV is a per-product stock valuation.

### Admin: products, variants, images

**AdminProduct** (list row) is:
- `{ id, name, slug, sku, brandId, brandName, categoryId, categoryName, department, sport, gender, type/productType, status, price, compareAtPrice, costPrice, taxRate, shortDescription, description, features[], specifications[]/specs[], tags[], sizeGuide, badge, isNew, isFeatured/featured, completeTheLook[], seo{title,description,keywords}, image, totalStock, available, reserved, stockStatus, variantsCount, unitsSold, revenue, views, rating, reviewCount, popularity, publishedAt, createdAt, updatedAt, deletedAt }`.
- The **detail** view adds `images[{id,url,alt,role,color,position,storageKey}]` and `variants[AdminVariant]`.

**AdminVariant** is `{ id, productId, sku, color, colorHex, size, price, compareAtPrice, stock, reserved, available, lowStockThreshold, stockStatus, barcode, weightGrams, position, isActive }`.

| Method | Path | Permission | Input | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/products` | `products:view` | See the list query below | Paginated `AdminProduct[]` | none |
| GET | `/admin/products/validate` | `products:view` | `field`* sku \| slug, `value`* (1–160), `excludeId` | `{ field, value, unique }` | none |
| PATCH | `/admin/products/bulk` | `products:edit` | `ids`* (1–200), `status` and/or `categoryId` | `{ updated }` | NOT_FOUND (some id unknown), VALIDATION_ERROR (publishing requirements) |
| POST | `/admin/products/bulk-delete` | `products:delete` | `ids`* (1–200) | `{ deleted[], archived[] }` | NOT_FOUND |
| POST | `/admin/products` | `products:create` · write limit | **ProductInput** (below) | **201** product detail | CONFLICT (SKU or slug taken, duplicate variant SKU), VALIDATION_ERROR |
| GET | `/admin/products/:id` | `products:view` | none | Product detail | NOT_FOUND |
| PATCH / PUT | `/admin/products/:id` | `products:edit` | ProductInput, all fields optional | Product detail | NOT_FOUND, CONFLICT, VALIDATION_ERROR |
| PATCH | `/admin/products/:id/status` | `products:edit` | `status`* DRAFT \| PUBLISHED \| ARCHIVED | Product detail | NOT_FOUND, VALIDATION_ERROR (not publishable) |
| DELETE | `/admin/products/:id` | `products:delete` | none | `{ id, result: DELETED\|ARCHIVED, deleted, archived }` | NOT_FOUND |
| POST | `/admin/products/:id/duplicate` | `products:create` | none | **201** detail of the new DRAFT copy | NOT_FOUND |
| POST | `/admin/products/:id/variants` | `products:edit` | VariantInput (without `id`) | **201** `AdminVariant` | NOT_FOUND, CONFLICT (colour/size exists, SKU taken) |
| PATCH | `/admin/products/:id/variants/:variantId` | `products:edit` | VariantInput, partial | `AdminVariant` | NOT_FOUND, CONFLICT |
| DELETE | `/admin/products/:id/variants/:variantId` | `products:edit` | none | `data: null` (soft delete) | NOT_FOUND, CONFLICT (units reserved for open orders) |
| POST | `/admin/products/:id/images` | `products:edit` · write limit | multipart: `file`*, `role` (MAIN\|GALLERY\|HOVER), `color` (≤ 40), `alt` (≤ 200) | **201** image | NOT_FOUND, PAYLOAD_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE, VALIDATION_ERROR (no file) |
| PUT | `/admin/products/:id/images/order` | `products:edit` | `ids`* (every image id exactly once) | Image array | VALIDATION_ERROR |
| PATCH | `/admin/products/:id/images/:imageId` | `products:edit` | `role`, `alt`, `color` (nullable), `position` (0–1000) | Image | NOT_FOUND |
| DELETE | `/admin/products/:id/images/:imageId` | `products:edit` | none | `data: null` (the stored file is removed) | NOT_FOUND |

**`/admin/products` list query**

| Param | Rule |
| --- | --- |
| `page` | Standard |
| `limit` | Default 20, max 100 |
| `search` | Text |
| `categoryId`, `brandId` | uuid |
| `status` | DRAFT \| PUBLISHED \| ARCHIVED |
| `stock` | IN_STOCK \| LOW_STOCK \| OUT_OF_STOCK |
| `sport` | Sport enum |
| `gender` | MEN \| WOMEN \| KIDS \| UNISEX |
| `minPrice`, `maxPrice` | Integers |
| `sort` | newest \| oldest \| price \| stock \| sales \| name \| updated (default) |
| `order` | asc \| desc |
| `includeDeleted` | Boolean |

Empty strings are treated as "not set".

**ProductInput** (create requires `name`, `sku`, `brandId`, `categoryId`, `sport`, `price`)

| Field | Rule |
| --- | --- |
| `name` | 2–160 characters |
| `slug` | ≤ 120 characters; auto-generated when omitted |
| `sku` | 2–41 of A-Z 0-9 -, upper-cased |
| `shortDescription` | ≤ 500 characters |
| `description` | ≤ 10 000 characters |
| `brandId`, `categoryId` | uuid. An unknown id gives 400. |
| `department` | footwear \| apparel \| equipment \| accessories. Derived from the category when omitted. |
| `sport` | football \| basketball \| running \| training \| lifestyle \| multi-sport |
| `gender` | MEN \| WOMEN \| KIDS \| UNISEX. Case-insensitive. |
| `productType` | 1–40 characters. `type` is an alias. |
| `price` | Integer > 0 |
| `compareAtPrice` | Must be greater than `price`; nullable |
| `costPrice` | Nullable |
| `taxRate` | 0–100, nullable |
| `status` | DRAFT \| PUBLISHED \| ARCHIVED |
| `isFeatured` | Boolean. `featured` is an alias. |
| `isNew` | Boolean |
| `badge` | new \| bestseller \| limited \| exclusive \| null |
| `features[]` | ≤ 30 items |
| `specifications[{label,value}]` | ≤ 50 items. `specs` is an alias. |
| `tags[]` | ≤ 30 items |
| `sizeGuide` | footwear \| apparel \| gloves \| ball \| none |
| `completeTheLook[]` | uuid, ≤ 12 items |
| `seo{title,description,keywords}` | Alternatively, send `seoTitle` / `seoDescription` |
| `popularity` | Integer |
| `variants[]` | ≤ 200 VariantInput items. **This is the full list: existing variants that are omitted are removed.** |
| `images[]` | ≤ 30 items of `{ id?, url (http(s)), alt, role, color, position }` |

**VariantInput**

| Field | Rule |
| --- | --- |
| `id` | Only in full-form updates, to reference an existing variant |
| `sku` | 2–61 characters; auto-generated when omitted |
| `color`* | 1–40 characters |
| `colorHex` | `#RRGGBB` |
| `size`* | 1–20 characters |
| `price`, `compareAtPrice` | Nullable variant-level overrides |
| `stock` | 0–1 000 000 |
| `lowStockThreshold` | Integer |
| `barcode` | ≤ 64 characters |
| `weightGrams` | Integer |
| `isActive` | Boolean |
| `position` | Integer |

**Product rules**

- Publishing is validated: a product with missing requirements returns 400 "Add … before publishing".
- A product that has order history is **archived** instead of deleted.

### Admin: categories

| Method | Path | Permission | Body | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/categories` | `categories:view` | none | Flat list in tree order: `[AdminCategory]` | none |
| PUT | `/admin/categories/order` | `categories:edit` | `ids`* (1–500, siblings of the same parent) | Full list | NOT_FOUND, VALIDATION_ERROR (mixed parents) |
| POST | `/admin/categories` | `categories:create` | See the fields below | **201** `AdminCategory` | CONFLICT (slug), VALIDATION_ERROR (parent not found or cycle) |
| GET | `/admin/categories/:id` | `categories:view` | none | `AdminCategory` | NOT_FOUND |
| PATCH / PUT | `/admin/categories/:id` | `categories:edit` | Same fields, all optional | `AdminCategory` | NOT_FOUND, CONFLICT, VALIDATION_ERROR |
| PATCH | `/admin/categories/:id/status` | `categories:edit` | `status` active \| inactive, or `isActive` | `AdminCategory` | NOT_FOUND |
| DELETE | `/admin/categories/:id` | `categories:delete` | none | `data: null` | NOT_FOUND, CONFLICT (`reason: has_children` / `has_products`) |
| POST | `/admin/categories/:id/image` | `categories:edit` · write limit | multipart `file` | `AdminCategory` | NOT_FOUND, PAYLOAD_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE |

**Fields** (create requires `name`)

| Field | Rule |
| --- | --- |
| `name`* | 1–80 characters |
| `slug` | ≤ 120 characters |
| `description` | ≤ 2000 characters |
| `imageUrl` | http(s) URL, nullable |
| `parentId` | uuid, nullable |
| `status` | active \| inactive. Alternatively send `isActive`. |
| `sortOrder` | Integer. `position` is an alias. |
| `seoTitle` | ≤ 160 characters |
| `seoDescription` | ≤ 320 characters |

**AdminCategory** is `{ id, name, slug, description, imageUrl, parentId, status (active|inactive), isActive, position, sortOrder, seoTitle, seoDescription, depth, productCount, totalProductCount, childrenCount, createdAt, updatedAt }`.

### Admin: brands

Brands use the **`categories:*`** permissions.

| Method | Path | Permission | Body / Query | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/brands` | `categories:view` | `search` (≤ 80) | `[AdminBrand]` (not paginated) | none |
| POST | `/admin/brands` | `categories:create` | See the fields below | **201** `AdminBrand` | CONFLICT (name or slug) |
| GET | `/admin/brands/:id` | `categories:view` | none | `AdminBrand` | NOT_FOUND |
| PATCH / PUT | `/admin/brands/:id` | `categories:edit` | Same fields, all optional | `AdminBrand` | NOT_FOUND, CONFLICT |
| PATCH | `/admin/brands/:id/status` | `categories:edit` | `status` or `isActive` | `AdminBrand` | NOT_FOUND |
| DELETE | `/admin/brands/:id` | `categories:delete` | none | `data: null` | NOT_FOUND, CONFLICT (`reason: has_products`) |
| POST | `/admin/brands/:id/logo` | `categories:edit` · write limit | multipart `file` | `AdminBrand` | NOT_FOUND, PAYLOAD_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE |

**Fields** (create requires `name`)

| Field | Rule |
| --- | --- |
| `name`* | 1–80 characters |
| `slug` | ≤ 120 characters |
| `description` | ≤ 2000 characters |
| `logoUrl` | http(s) URL, nullable |
| `website` | http(s) URL, `''` or null |
| `status` | active \| inactive. Alternatively send `isActive`. |

**AdminBrand** is `{ id, name, slug, description, logoUrl, website, productCount, status, isActive, createdAt, updatedAt }`.

### Admin: inventory

**InventoryItem** is `{ variantId, productId, productName, productSku, productType, productStatus, image, productImage, variantLabel, sku, color, colorHex, size, active, stock, reserved, available, threshold, status (IN_STOCK|LOW_STOCK|OUT_OF_STOCK), unitCost, price, daysSinceRestock, lastRestockedAt, updatedAt }`.

| Method | Path | Permission | Input | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/inventory` | `inventory:view` | See the list query below | Paginated `InventoryItem[]` plus a sibling `summary{total,inStock,lowStock,outOfStock,units,reserved}` | none |
| GET | `/admin/inventory/low-stock` | `inventory:view` | Same, with `status=LOW_STOCK` forced | same | none |
| GET | `/admin/inventory/out-of-stock` | `inventory:view` | Same, with `status=OUT_OF_STOCK` forced | same | none |
| GET | `/admin/inventory/movements` | `inventory:view` | See the movements query below | Paginated `InventoryMovement[]` | none |
| POST | `/admin/inventory/adjustments` | `inventory:edit` | `variantId`* + AdjustInput | `{ item, movement }` | NOT_FOUND, VALIDATION_ERROR, CONFLICT |
| GET | `/admin/inventory/:variantId` | `inventory:view` | none | `InventoryItem` | NOT_FOUND |
| PATCH | `/admin/inventory/:variantId` | `inventory:edit` | `stockQuantity` (0–1 000 000) and/or `lowStockThreshold` (0–100 000), `reason`, `note` | `{ item, movement\|null }` | NOT_FOUND, VALIDATION_ERROR, CONFLICT |
| POST | `/admin/inventory/:variantId/adjust` | `inventory:edit` | AdjustInput | `{ item, movement }` | NOT_FOUND, VALIDATION_ERROR (would go below 0), CONFLICT (would go below reserved) |

**`/admin/inventory` list query**

The std list query plus:

| Param | Rule |
| --- | --- |
| `sort` | product_name \| sku \| stock \| available \| threshold \| updated_at \| days_since_restock |
| `status` | IN_STOCK \| LOW_STOCK \| OUT_OF_STOCK |
| `productType` | Text. `product_type` is an alias. |
| `productId` | uuid. `product` is an alias. |
| `includeArchived` | true \| false |

**`/admin/inventory/movements` query**

The std list query plus:

| Param | Rule |
| --- | --- |
| `sort` | created_at \| change |
| `variantId` | uuid. `variant` is an alias. |
| `productId` | uuid. `product` is an alias. |
| `reason` | Movement reason |
| `adminId` | uuid. `admin` is an alias. |
| `direction` | in \| out |

**AdjustInput**

| Field | Rule |
| --- | --- |
| `mode`* | add \| remove \| set |
| `quantity`* | 0–1 000 000; must be ≥ 1 unless mode is `set` |
| `reason`* | RESTOCK \| MANUAL_ADJUSTMENT \| DAMAGED \| RETURNED \| OTHER. `MANUAL_CORRECTION` and `SALE_ADJUSTMENT` map to MANUAL_ADJUSTMENT. |
| `note` | ≤ 500 characters. `notes` is an alias. **Required (≥ 3 characters) when reason=OTHER.** |

- **InventoryMovement** is `{ id, variantId, productId, productName, sku, variantLabel, change, quantity, direction, previousStock, newStock, reason, note, orderId, orderNumber, adminId, adminName, createdAt }`.
- `POST /admin/inventory/adjustments` is the body-addressed form of `/:variantId/adjust`. Its AdjustInput errors come back as a Zod `details.fieldErrors` object, not nested under `body`.

### Admin: orders

| Method | Path | Permission | Input | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/orders` | `orders:view` | See the list query below | Paginated `OrderSummary[]` | none |
| GET | `/admin/orders/counts` | `orders:view` | none | `{ ALL, <each status>, NEEDS_ACTION, REFUND_REQUESTS }` | none |
| GET | `/admin/orders/:id` | `orders:view` | `:id` is a UUID **or order number** | `Order` (admin view) | NOT_FOUND |
| PATCH | `/admin/orders/:id/status` | `orders:edit` | `status`* (one of PROCESSING, PACKED, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, REFUND_REQUESTED), `note` (≤ 500) | `Order` | NOT_FOUND, ORDER_INVALID (transition not allowed, `details.allowed`) |
| PATCH | `/admin/orders/:id/payment-status` | `orders:approve` | `status`* PAID \| FAILED, `note` | `Order` | NOT_FOUND, FORBIDDEN (online payment), CONFLICT (payment already refunded), ORDER_INVALID |
| POST | `/admin/orders/:id/cancel` | `orders:edit` | `reason`* (2–300), `refund` (default true) | `Order` | NOT_FOUND, ORDER_INVALID, PAYMENT_FAILED |
| POST | `/admin/orders/:id/refund` | `orders:approve` | See the refund body below. Header `Idempotency-Key` (optional). | `{ refund, order }`. Message: "Refund completed." or "Refund is processing." | NOT_FOUND, ORDER_INVALID (nothing captured), VALIDATION_ERROR (amount over refundable balance, `details.refundable`), PAYMENT_FAILED (provider rejected) |
| PATCH | `/admin/orders/:id/shipping` | `orders:edit` | `carrier` (≤ 80), `trackingNumber` (≤ 80), `estimatedDeliveryAt` (ISO with offset, nullable) | `Order`. A new tracking number adds an order event. | NOT_FOUND |
| POST | `/admin/orders/:id/notes` | `orders:edit` | `note`* (1–1000) | `Order` (the note appears in `events`) | NOT_FOUND |

**`/admin/orders` list query**

| Param | Rule |
| --- | --- |
| `page` | Standard |
| `limit` | Default 20, max 100 |
| `search` | Matches order number, email, phone or name |
| `status` | Order status. `SHIPPED` also matches OUT_FOR_DELIVERY. |
| `payment_status` | Payment status |
| `shipping_status` | Shipping status |
| `payment_method` | Payment method |
| `customer_id` | uuid |
| `date_from`, `date_to` | Date strings |
| `min_total`, `max_total` | Integers |
| `sort` | placed_at (default) \| grand_total \| order_number \| status |
| `order` | asc \| desc |

**Refund body**

| Field | Rule |
| --- | --- |
| `type` | full (default) \| partial |
| `amount` | int > 0. **Required for a partial refund.** |
| `reason`* | CUSTOMER_REQUEST \| DAMAGED_ITEM \| WRONG_ITEM \| PAYMENT_ISSUE \| OTHER |
| `note` | ≤ 500 characters |
| `restock` | Default false |

A Refund is `{ id, orderId, paymentId, amount, reason, note, status: REQUESTED|PROCESSING|COMPLETED|FAILED, providerReference, restock, failureReason, createdAt }`.

**Behaviour**

- **Status changes:** all changes go through the state machine and are audited.
- **Payment status:** only works for offline payments (cash on delivery, bank transfer). Marking a payment PAID confirms the order.
- **Cancel:** cancelling a paid order also refunds it, unless `refund: false`. The refund uses the key `cancel-refund:<id>`.
- **Refund:** the order moves to REFUNDED or CANCELLED automatically when the balance is fully refunded.

### Admin: customers

"Customers" means users with the CUSTOMER role.

**CustomerRow** is `{ id, firstName, lastName, name, email, phone, avatarUrl, status, ordersCount, totalSpent, averageOrder, lastOrderAt, lastLoginAt, city, joinedAt, groups[] }`.

| Method | Path | Permission | Input | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/customers` | `customers:view` | Std list plus: `sort` (joined_at \| name \| orders_count \| total_spent \| last_order_at), `status` (ACTIVE\|INACTIVE\|BLOCKED, case-insensitive), `group` (all \| new \| returning \| high_value \| inactive), `city` | Paginated `CustomerRow[]` | none |
| GET | `/admin/customers/groups` | `customers:view` | none | `[{ id, count, revenue, rule }]` | none |
| GET | `/admin/customers/:id` | `customers:view` | none | CustomerDetail (see below) | NOT_FOUND |
| GET | `/admin/customers/:id/activity` | `customers:view` | none | `[{ id, customerId, type, title, description, link, createdAt }]` (≤ 60, newest first) | NOT_FOUND |
| GET | `/admin/customers/:id/orders` | `customers:view` | `page`; `limit` (default 20, max 100) | Paginated `OrderSummary[]` | NOT_FOUND |
| PATCH | `/admin/customers/:id` | `customers:edit` | `firstName`, `lastName` (1–80), `phone` (≤ 30, `[+0-9 ()-]`, nullable), `marketingOptIn`, `notes` (≤ 2000, nullable). At least one field. | CustomerDetail | NOT_FOUND |
| PATCH | `/admin/customers/:id/status` | `customers:edit` | `status`* ACTIVE \| INACTIVE \| BLOCKED, `reason` (≤ 500) | CustomerDetail | NOT_FOUND, FORBIDDEN (staff account; manage it from Admin users) |

- Customer groups:
  - new: joined ≤ 30 days ago;
  - returning: ≥ 2 orders;
  - high_value: spent ≥ DJF 80 000;
  - inactive: no order in 60 days.
- **CustomerDetail** is a CustomerRow plus:
  - `marketingOptIn`, `notes`
  - `stats{ordersCount,totalSpent,averageOrder,lastOrderAt,cancelledOrders,refundedTotal,reviews,tickets,openTickets}`
  - `addresses[]`, `wishlist{count,items[≤ 12]}`, `wishlistProductIds[]`
  - `recentOrders[]`, `reviews[]`, `tickets[]`, `activity[≤ 40]`
- Setting a status other than ACTIVE revokes all of the customer's refresh sessions immediately.
- Activity entry `type` is one of `account_created`, `order_placed`, `order_status`, `review_posted`, `ticket_opened`, `status_changed`.

### Admin: reviews

| Method | Path | Permission | Input | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/reviews` | `reviews:view` | See the list query below | Paginated `AdminReview[]` plus a sibling `counts{ALL,PENDING,APPROVED,REJECTED,HIDDEN}` (counts ignore the status filter) | none |
| PATCH | `/admin/reviews/bulk` | `reviews:approve` | `ids`* (1–200), `status`* | `{ updated, status }` | none |
| GET | `/admin/reviews/:id` | `reviews:view` | none | `AdminReview` | NOT_FOUND |
| PATCH | `/admin/reviews/:id/status` | `reviews:approve` | `status`* (PENDING \| APPROVED \| REJECTED \| HIDDEN, case-insensitive) | `AdminReview` | NOT_FOUND |
| DELETE | `/admin/reviews/:id` | `reviews:delete` | none | `data: null` (soft delete) | NOT_FOUND |

**`/admin/reviews` list query**

The std list query plus:

| Param | Rule |
| --- | --- |
| `sort` | created_at \| rating \| helpful_count \| moderated_at |
| `status` | PENDING \| APPROVED \| REJECTED \| HIDDEN |
| `rating` | 1–5 |
| `productId` | uuid. `product` is an alias. |
| `customerId` | uuid |
| `from` | `YYYY-MM-DD`; alias of `date_from` |

- **AdminReview** is `{ id, productId, productName, productSlug, productType, productImage, customerId, customerName, customerEmail, orderId, orderNumber, rating, title, comment, body, fit, size, status, verifiedPurchase, helpfulCount, moderatedAt, moderatedBy, createdAt, updatedAt }`.
- Product ratings are recomputed by a database trigger from approved reviews.

### Admin: coupons

**Coupon** is `{ id, code, description, type (PERCENTAGE|FIXED), value, minOrder, maxDiscount, usageLimit, perCustomerLimit, usageCount, discountTotal, startsAt, endsAt, enabled, status (active|scheduled|expired|disabled), categoryIds[], productIds[], customerGroups[], createdBy, createdAt, updatedAt }`.

| Method | Path | Permission | Input | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/coupons` | `discounts:view` | Std list plus: `sort` (created_at \| code \| usage_count \| starts_at \| ends_at \| value), `status` (active \| scheduled \| expired \| disabled), `type` | Paginated `Coupon[]` plus a sibling `counts{all,active,scheduled,expired,disabled}` | none |
| GET | `/admin/coupons/:id` | `discounts:view` | none | `Coupon` | NOT_FOUND |
| GET | `/admin/coupons/:id/usages` | `discounts:view` | `page`, `limit` | Paginated `[{ id, orderId, orderNumber, customerId, customerName, email, discountAmount, orderTotal, createdAt }]` | NOT_FOUND |
| POST | `/admin/coupons` | `discounts:create` | CouponInput. Requires `code`, `type`, `value`. | **201** `Coupon` | VALIDATION_ERROR (field map), CONFLICT (code exists) |
| PATCH / PUT | `/admin/coupons/:id` | `discounts:edit` | CouponInput, any subset. `{ enabled }` alone toggles the coupon. | `Coupon` | NOT_FOUND, VALIDATION_ERROR, CONFLICT (code changed after use, or duplicate) |
| DELETE | `/admin/coupons/:id` | `discounts:delete` | none | `data: null` (soft delete; the code becomes reusable) | NOT_FOUND |

**CouponInput**

| Field | Rule |
| --- | --- |
| `code` | 3–32 characters of A-Z 0-9 - _, upper-cased |
| `description` | ≤ 300 characters |
| `type` | PERCENTAGE \| FIXED |
| `value` | int > 0; ≤ 100 for PERCENTAGE |
| `minOrder` | Integer. `minimumOrderAmount` is an alias. |
| `maxDiscount` | PERCENTAGE only. `maximumDiscount` is an alias. |
| `usageLimit` | Integer ≥ 1 |
| `perCustomerLimit` | Must be ≤ `usageLimit`. `perUserLimit` is an alias. |
| `startsAt` | ISO or `YYYY-MM-DD` |
| `endsAt` | Must be after `startsAt`; nullable |
| `enabled` | Boolean. `isActive` is an alias. |
| `categoryIds[]` | ≤ 200 items |
| `productIds[]` | ≤ 500 items |
| `customerGroups[]` | all \| new \| returning \| high_value \| inactive. `all` means no restriction. |

### Admin: discounts (automatic)

**Discount** is `{ id, name, type, value, appliesTo (ALL|PRODUCTS|CATEGORIES|BRANDS), targetIds[], targets[{id,name}], startsAt, endsAt, enabled, status (active|scheduled|expired|disabled), createdAt, updatedAt }`.

| Method | Path | Permission | Input | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/discounts` | `discounts:view` | Std list plus: `sort` (created_at \| name \| starts_at \| ends_at \| value), `status`, `appliesTo` | Paginated `Discount[]` | none |
| GET | `/admin/discounts/:id` | `discounts:view` | none | `Discount` | NOT_FOUND |
| POST | `/admin/discounts` | `discounts:create` | See the fields below. **Requires `name`, `type`, `value`.** | **201** `Discount` | VALIDATION_ERROR (field map, unknown target ids) |
| PATCH / PUT | `/admin/discounts/:id` | `discounts:edit` | Any subset | `Discount` | NOT_FOUND, VALIDATION_ERROR |
| DELETE | `/admin/discounts/:id` | `discounts:delete` | none | `data: null` (hard delete) | NOT_FOUND |

**Fields**

| Field | Rule |
| --- | --- |
| `name` | 2–120 characters |
| `type` | PERCENTAGE \| FIXED |
| `value` | Integer > 0; ≤ 100 for PERCENTAGE |
| `appliesTo` | ALL (default) \| PRODUCTS \| CATEGORIES \| BRANDS |
| `targetIds[]` | ≤ 500 items. Required unless `appliesTo` is ALL. |
| `startsAt` | ISO or `YYYY-MM-DD` |
| `endsAt` | Must be after `startsAt`; nullable |
| `enabled` | Boolean |

Pricing applies the best automatic discount or flash sale to each unit. Promotions do not stack.

### Admin: flash sales

**FlashSale** is `{ id, name, discountPercent, productIds[], products[{id,name,price,image}], startsAt, endsAt, enabled, status (upcoming|active|ended|disabled), unitsSold, revenue, orders, createdAt, updatedAt }`.

| Method | Path | Permission | Input | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/flash-sales` | `discounts:view` | Std list plus: `sort` (starts_at (default) \| ends_at \| created_at \| name \| discount_percent), `status` (upcoming \| active \| ended \| disabled) | Paginated `FlashSale[]` | none |
| GET | `/admin/flash-sales/:id` | `discounts:view` | none | `FlashSale` | NOT_FOUND |
| POST | `/admin/flash-sales` | `discounts:create` | See the fields below | **201** `FlashSale` | VALIDATION_ERROR |
| PATCH / PUT | `/admin/flash-sales/:id` | `discounts:edit` | Any subset | `FlashSale` | NOT_FOUND, VALIDATION_ERROR |
| DELETE | `/admin/flash-sales/:id` | `discounts:delete` | none | `data: null` | NOT_FOUND |

**Fields**

| Field | Rule |
| --- | --- |
| `name` | 2–120 characters |
| `discountPercent` | 1–90 |
| `productIds[]` | 1–500 items |
| `startsAt` | ISO or `YYYY-MM-DD` |
| `endsAt` | Must be after `startsAt` |
| `enabled` | Boolean |

After merging with the current record, `name`, `discountPercent`, `productIds`, `startsAt` and `endsAt` must all be set.

### Admin: campaigns

**Campaign** is `{ id, name, type, description, bannerUrl, productIds[], categoryIds[], startsAt, endsAt, status, impressions, clicks, ctr, revenue, unitsSold, createdAt, updatedAt }`.

| Method | Path | Permission | Input | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/campaigns` | `discounts:view` | Std list (see below) | Paginated `Campaign[]` | none |
| GET | `/admin/campaigns/:id` | `discounts:view` | none | `Campaign` | NOT_FOUND |
| POST | `/admin/campaigns` | `discounts:create` | See the fields below. Requires `name`, `type`, `startsAt`, `endsAt`. | **201** `Campaign` | VALIDATION_ERROR, CONFLICT |
| PATCH / PUT | `/admin/campaigns/:id` | `discounts:edit` | Any subset | `Campaign` | NOT_FOUND, VALIDATION_ERROR, CONFLICT |
| PATCH | `/admin/campaigns/:id/status` | `discounts:edit` | `status`* | `Campaign` | NOT_FOUND, CONFLICT |
| POST | `/admin/campaigns/:id/banner` | `discounts:edit` | multipart `file` | `Campaign` | NOT_FOUND, PAYLOAD_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE |
| DELETE | `/admin/campaigns/:id/banner` | `discounts:edit` | none | `Campaign` | NOT_FOUND |
| DELETE | `/admin/campaigns/:id` | `discounts:delete` | none | `data: null` | NOT_FOUND |

**`/admin/campaigns` list query**

The std list query plus:

| Param | Rule |
| --- | --- |
| `sort` | starts_at \| ends_at \| created_at \| name \| status |
| `status` | Campaign status |
| `type` | Campaign type |

`date_from` and `date_to` select campaigns that overlap the window.

**Fields**

| Field | Rule |
| --- | --- |
| `name` | 2–120 characters |
| `type` | seasonal \| new_arrivals \| football \| basketball \| training \| clearance \| limited_release |
| `description` | ≤ 2000 characters |
| `productIds[]` | ≤ 500 items |
| `categoryIds[]` | ≤ 100 items |
| `startsAt`, `endsAt` | `endsAt` must be after `startsAt` |
| `status` | DRAFT (default) \| SCHEDULED \| ACTIVE \| PAUSED \| ARCHIVED \| ENDED |

- Setting ACTIVE or SCHEDULED on a campaign that has already ended → CONFLICT.
- Revenue is attributed from non-cancelled order lines of the campaign's products or categories inside its window.

### Admin: support

| Method | Path | Permission | Input | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/support/assignees` | `support:view` | none | `[{ id, name, firstName, lastName, email, roleName }]` (active staff with `support:view`) | none |
| GET | `/admin/support/tickets` | `support:view` | Std list (see below) | Paginated `AdminTicket[]` plus a sibling `counts{ALL,OPEN,…}` | none |
| GET | `/admin/support/tickets/:id` | `support:view` | none | AdminTicketDetail (see below) | NOT_FOUND |
| PATCH | `/admin/support/tickets/:id/status` | `support:edit` | `status`* | AdminTicketDetail | NOT_FOUND |
| PATCH | `/admin/support/tickets/:id` | `support:edit` | `status`, `priority`, `assignedToId` (uuid or null). At least one field. | AdminTicketDetail | NOT_FOUND, VALIDATION_ERROR (invalid assignee) |
| POST | `/admin/support/tickets/:id/messages` | `support:edit` | `body`* (1–5000), `internal` (default false) | AdminTicketDetail. Message: "Reply sent." or "Note added." | NOT_FOUND, CONFLICT (public reply on a CLOSED ticket) |

**`/admin/support/tickets` list query**

The std list query plus:

| Param | Rule |
| --- | --- |
| `sort` | updated_at \| created_at \| priority \| status |
| `status` | Ticket status |
| `priority` | LOW \| NORMAL \| HIGH \| URGENT |
| `category` | Ticket category |
| `assignedToId` | uuid or `unassigned`. `assignee` is an alias. |
| `customerId` | uuid |

- **AdminTicket** is a Ticket plus `{ customerId, customerName, customerEmail, assignedToId, assignedToName }`.
- **AdminTicketDetail** adds:
  - `messages[{ id, ticketId, authorType, authorId, authorName, body, internal, createdAt }]` (internal notes included);
  - `customer{…, ordersCount, totalSpent, joinedAt}`;
  - `recentOrders[]`.
- A public reply:
  - moves an OPEN or IN_PROGRESS ticket to WAITING_CUSTOMER;
  - auto-assigns the ticket to the replier when it is unassigned;
  - notifies the customer in-app and by email.

### Admin: notifications

This is the shared staff centre (`audience = ADMIN`). **Any staff** member can use it; no permission is checked. The endpoints and shapes are the same as the [customer notifications](#14-notifications):

| Method | Path |
| --- | --- |
| GET | `/admin/notifications` (page, limit, unread, type) |
| GET | `/admin/notifications/unread-count` |
| PATCH | `/admin/notifications/read-all` |
| POST | `/admin/notifications/read-all` (alias of PATCH) |
| PATCH | `/admin/notifications` (`{ ids, read }`) |
| DELETE | `/admin/notifications` (`{ ids }`) |
| POST | `/admin/notifications/delete` (alias of DELETE) |
| PATCH | `/admin/notifications/:id/read` |
| PATCH | `/admin/notifications/:id/unread` |
| DELETE | `/admin/notifications/:id` |

Staff notification types: `LOW_STOCK`, `NEW_ORDER`, `PAYMENT_FAILED`, `REFUND_REQUESTED`, `NEW_TICKET`, `NEW_CUSTOMER`, `REVIEW_PENDING`.

### Admin: settings

`/admin/settings/store` is an alias of `/admin/settings`.

| Method | Path | Permission | Body | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/settings`, `/admin/settings/store` | `settings:view` | none | AdminSettings (see below) | none |
| PATCH / PUT | `/admin/settings`, `/admin/settings/store` | `settings:edit` | See the fields below. At least one field. | AdminSettings | VALIDATION_ERROR ("Nothing to update.", unknown timezone) |
| POST | `/admin/settings/logo` | `settings:edit` | multipart `file` | AdminSettings | VALIDATION_ERROR (no file), PAYLOAD_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE |
| GET | `/admin/settings/notifications` | `settings:view` | none | `[{ event, label, description, channels{email,sms,in_app} }]` | none |
| PUT / PATCH | `/admin/settings/notifications` | `settings:edit` | Array (≤ 50) of `{ event* (2–60), label (≤ 120), description (≤ 300), channels*{ email=false, sms=false, in_app=true } }`. Replaces the whole list. | Saved array | none |

**AdminSettings** is `{ storeName, tagline, supportEmail, email, phone, addressLine1, addressLine2, city, country, currency, timezone, logoUrl, taxRate, taxInclusive, freeShippingThreshold, orderPrefix, lowStockDefault, pendingPaymentTtlMinutes, maxQuantityPerLine, notificationSettings, updatedAt }`. `email` is an alias of `supportEmail`.

**Settings fields**

| Field | Rule |
| --- | --- |
| `storeName` | 2–80 characters |
| `tagline` | ≤ 160 characters |
| `supportEmail` | Email, `''` or null. `email` is an alias. |
| `phone` | ≤ 40 characters |
| `addressLine1`, `addressLine2` | ≤ 160 characters |
| `city` | ≤ 80 characters |
| `country` | 2–80 characters |
| `currency` | DJF \| USD \| EUR |
| `timezone` | IANA timezone name |
| `taxRate` | 0–100 |
| `taxInclusive` | Boolean |
| `freeShippingThreshold` | Integer, nullable |
| `orderPrefix` | 2–6 letters, upper-cased |
| `lowStockDefault` | Integer |
| `pendingPaymentTtlMinutes` | 5–10 080 |
| `maxQuantityPerLine` | 1–10 |
| `notificationSettings` | Object, ≤ 20 000 characters when serialised |

Settings changes are audited.

### Admin: payment settings

| Method | Path | Permission | Response |
| --- | --- | --- | --- |
| GET | `/admin/settings/payments` | `settings:view` | See below |

**Response**

- `{ providers[{ id, name, description, methods[], enabled, configured, mode (test|live|null), requiresWebhook, webhookUrl, fields[{key,label,secret,required,configured}] }], enabledOrder[], note }`
- The endpoint is read-only.
- Credentials live in environment variables. The response only reports **whether** each variable is set; it never returns key values or fragments.

### Admin: shipping

The canonical paths are under `/admin/shipping`. Each one is also mounted at `/admin/settings/shipping` with the same behaviour; for example, `PATCH /admin/settings/shipping/zones/:id` is the same as `PATCH /admin/shipping/zones/:id`.

| Method | Path | Permission | Body | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/shipping`, `/admin/shipping/zones` | `settings:view` | none | ShippingZone array (see below) | none |
| POST | `/admin/shipping/zones` | `settings:edit` | `name`* (2–80), `regions[]` (≤ 100 × 1–80), `enabled`, `sortOrder` (0–10 000) | **201** zone | VALIDATION_ERROR |
| PATCH / PUT | `/admin/shipping/zones/:id` | `settings:edit` | Same fields, all optional | Zone | NOT_FOUND |
| DELETE | `/admin/shipping/zones/:id` | `settings:edit` | none | `data: null` | NOT_FOUND, CONFLICT (referenced) |
| POST | `/admin/shipping/methods` | `settings:edit` | ShippingMethodInput (below). Requires `zoneId`, `name`, `price`. | **201** method | VALIDATION_ERROR (field map, unknown zone), CONFLICT (code in use) |
| PATCH / PUT | `/admin/shipping/methods/:id` | `settings:edit` | ShippingMethodInput, any subset | Method | NOT_FOUND, VALIDATION_ERROR, CONFLICT |
| PATCH | `/admin/shipping/:id` | `settings:edit` | Same as above; **`:id` is a method id** | Method | NOT_FOUND, VALIDATION_ERROR, CONFLICT |
| DELETE | `/admin/shipping/methods/:id` | `settings:edit` | none | `data: null` | NOT_FOUND, CONFLICT (referenced) |

- A **ShippingZone** is `{ id, name, regions[], enabled, sortOrder, updatedAt, methods[AdminShippingMethod] }`.
- An **AdminShippingMethod** is `{ id, zoneId, code, name, description, price, freeShippingThreshold, minDays, maxDays, estimatedDelivery ("2–4 days"), requiresAddress, carrier, enabled, sortOrder, updatedAt }`.

**ShippingMethodInput**

| Field | Rule |
| --- | --- |
| `zoneId` | uuid |
| `code` | `^[a-z0-9_-]{2,40}$`; generated from the name when omitted |
| `name` | 2–80 characters |
| `description` | ≤ 300 characters |
| `price` | 0–10 000 000 |
| `freeShippingThreshold` | Integer, nullable |
| `minDays`, `maxDays` | 0–90; `maxDays` must be ≥ `minDays` |
| `estimatedDelivery` | Text such as "2–4 days". Parsed only when `minDays`/`maxDays` are absent. |
| `requiresAddress` | Default true |
| `carrier` | ≤ 80 characters, nullable |
| `enabled` | Boolean |
| `sortOrder` | Integer |

### Admin: staff

`/admin/admin-users*` is an alias of `/admin/staff*`.

**Staff** is `{ id, firstName, lastName, name, email, phone, avatarUrl, roles[{id,slug,name}], roleId, roleSlug, roleName, status, invited (never signed in), lastLoginAt, createdAt }`.

| Method | Path | Permission | Body / Query | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/staff` | `settings:view` | Std list plus: `sort` (created_at \| name \| email \| last_login_at), `status`, `role` | Paginated `Staff[]` | none |
| GET | `/admin/staff/:id` | `settings:view` | none | `Staff` | NOT_FOUND |
| POST | `/admin/staff` | **`settings:create`** | See the invite body below | **201** `Staff` | CONFLICT (already staff), FORBIDDEN (only SUPER_ADMIN can create a SUPER_ADMIN), VALIDATION_ERROR (unknown role) |
| PATCH / PUT | `/admin/staff/:id` | `settings:edit` | `firstName`, `lastName`, `name`, `phone`, `roleSlug` \| `roleId` | `Staff` | NOT_FOUND, FORBIDDEN, CONFLICT |
| PATCH | `/admin/staff/:id/status` | `settings:edit` | `status`*, `reason` (≤ 500) | `Staff` | NOT_FOUND, FORBIDDEN, CONFLICT |
| POST | `/admin/staff/:id/reset-access` | `settings:edit` | none | `{ sessionsRevoked: true, resetEmailSent }` | NOT_FOUND, FORBIDDEN |

**Invite body**

| Field | Rule |
| --- | --- |
| `email`* | Email |
| `firstName` + `lastName` | 1–80 characters each. Alternatively send `name`, which is split into first and last name. |
| `phone` | `[+0-9 ()-]`, ≤ 30 characters |
| `roleSlug` or `roleId`* | Must be a staff role |

**Invite behaviour**

- Creates the account, or adds the staff role to an existing customer account with the same email.
- Emails a set-password link. Nobody ever sees the password.

**Update rules** (`PATCH / PUT /admin/staff/:id`)

- You cannot change your own role.
- Granting or removing the SUPER_ADMIN role requires a SUPER_ADMIN.
- At least one active SUPER_ADMIN must remain (CONFLICT otherwise).

**Status rules** (`PATCH /admin/staff/:id/status`)

- `status` accepts ACTIVE \| INACTIVE \| BLOCKED, and also `active`, `deactivated` and `invited`.
- You cannot deactivate yourself.
- Changing a SUPER_ADMIN requires a SUPER_ADMIN.
- The last active SUPER_ADMIN cannot be deactivated (CONFLICT).

**Reset access:** revokes all of the staff member's sessions and sends a reset email when the account is active.

### Admin: roles & permissions

**Role** is `{ id, slug, name, description, isSystem, isStaff, immutable, permissions[], userCount, createdAt, updatedAt }`.

| Method | Path | Permission | Body | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/roles` | `settings:view` | none | `Role[]` (staff roles) | none |
| GET | `/admin/roles/:id` | `settings:view` | `:id` is a role UUID **or slug** | `Role` | NOT_FOUND |
| POST | `/admin/roles` | `settings:create` | See the body below | **201** `Role` | VALIDATION_ERROR (unknown permissions), FORBIDDEN (granting permissions you don't hold), CONFLICT (name or slug exists) |
| PATCH / PUT | `/admin/roles/:id` | `settings:edit` | Same fields, any subset | `Role` | NOT_FOUND, FORBIDDEN, CONFLICT |
| DELETE | `/admin/roles/:id` | `settings:delete` | none | `data: null` | NOT_FOUND, FORBIDDEN (default roles), CONFLICT (in use, `details.userCount`) |
| GET | `/admin/permissions` | `settings:view` | none | `[{ module, label, permissions[{ key, action, description }] }]` | none |

**Body fields** (create requires `name`)

| Field | Rule |
| --- | --- |
| `name`* | 2–60 characters |
| `slug` | Normalised to `UPPER_SNAKE`; generated from the name when omitted |
| `description` | ≤ 300 characters |
| `permissions[]` | `module:action` keys, ≤ 200 |

**Rules**

- SUPER_ADMIN and non-staff roles cannot be modified (FORBIDDEN).
- The slug of a system role is fixed.
- You cannot remove role-management permissions from your own role (CONFLICT).
- Non-super-admins can only grant permissions they hold themselves.
- Permission changes apply on the next request.

### Admin: activity (audit log)

`/admin/activity*` is an alias of `/admin/activity-logs*`.

| Method | Path | Permission | Query | Response |
| --- | --- | --- | --- | --- |
| GET | `/admin/activity-logs` | `settings:view` | See the query below | Paginated ActivityLog array (see below) |
| GET | `/admin/activity-logs/filters` | `settings:view` | none | `{ modules[], actions[] (≤ 200), admins[{id,name}] }` |

**Query**

The std list query plus:

| Param | Rule |
| --- | --- |
| `sort` | created_at \| action |
| `adminId` | uuid. `admin` is an alias. |
| `module` | Text. `entityType` is an alias. |
| `entityId` | Text |
| `action` | ILIKE pattern |
| `status` | SUCCESS \| FAILED |
| `from`, `to` | Aliases of `date_from` and `date_to` |

**ActivityLog entry** is `{ id, adminId, adminName, adminEmail, action, module, entityType, entityId, record, recordLink, metadata, status, ipAddress, userAgent, createdAt }`.

### Admin: search

| Method | Path | Permission | Query | Response |
| --- | --- | --- | --- | --- |
| GET | `/admin/search` | any staff | `q` (≤ 100; fewer than 2 characters returns `[]`), `limit` (1–5 per group, default 5) | `[{ id, group: orders\|products\|customers\|tickets\|categories, title, subtitle, meta?, to, image? }]` |

- Each group is searched only when the caller holds the matching permission:
  - orders: `orders:view`
  - products: `products:view`
  - customers: `customers:view`
  - tickets: `support:view`
  - categories: `categories:view`
- Order numbers and phone numbers are also matched in compact form ("spx2026 12" matches "SPX202612").
