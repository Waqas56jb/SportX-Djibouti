# SPORTX — Customer Storefront

**MOVE. TRAIN. PERFORM.**

This is the customer-facing web store for SPORTX, a premium sportswear and equipment retailer in Djibouti. It's built with React, Vite, TypeScript and Tailwind CSS.

The app runs fully in the browser against a **mock service layer**. There is no backend yet. Every data call goes through `src/services/*`. When the Node.js + Supabase API is ready, you connect it by changing environment variables. You don't need to rewrite any UI.

---

## Quick start

```bash
cd customer
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
npm run typecheck
```

**Demo account:** `demo@example.com` / `sportx123`. It comes with seeded orders, addresses, reviews and support tickets.
**Test card:** `4242 4242 4242 4242`, with any future expiry and any CVC. A card number ending `0002` simulates a decline.
**Promo code:** `WELCOME10`

> **Logo:** place the official file at `customer/public/logo.png`. Until then, the UI shows a typographic "SPORTX" wordmark as a fallback.

---

## Architecture

```
src/
├── components/
│   ├── common/        Design-system primitives: Button, inputs, Modal, Drawer, Toast,
│   │                  Skeleton, EmptyState, ErrorState, ConfirmDialog, Rating, Price…
│   ├── layout/        Header, Footer, MainLayout, CheckoutLayout, auth guards
│   ├── navigation/    Desktop mega-nav, mobile menu drawer, search overlay
│   ├── product/       ProductCard, grid, carousel, gallery, Quick View, variant
│   │                  selectors, size guide, catalog view + filters
│   ├── cart/          Cart drawer, line items, totals, coupon form
│   ├── checkout/      Stepper, information/shipping/payment steps, order summary
│   ├── account/       Account layout/navigation, address form
│   ├── order/         Order card, status badges, timeline, invoice parts
│   ├── review/        Rating breakdown, review list, review form
│   └── marketing/     Homepage sections (hero, campaigns, spotlights, newsletter…)
├── pages/             One folder per route group (Home, Shop, Product, Cart, Checkout,
│                      Auth, Account, Orders, Wishlist, Search, Categories, About,
│                      Contact, FAQ, Legal, NotFound)
├── services/          Backend boundary (see below)
├── store/             Zustand stores: cart, wishlist, auth, checkout, history, UI, toasts
├── hooks/             useCart, useWishlist, useAuth, useProducts, useSearch, useAsync,
│                      usePageMeta, useCatalogParams, UI hooks
├── data/              Mock catalogue (40 products), collections, navigation, FAQ, seeds
├── constants/         Brand info, currency and shipping config, routes, labels
├── types/             Domain types (Product, Order, Cart, User, Review, SupportTicket…)
├── utils/             Formatting, validation, cart totals, product helpers
└── routes/            Router config with lazy-loaded pages
```

### Service layer and backend integration

Pages and components never import mock data directly. Every service method looks like this:

```ts
async list(query) {
  if (!USE_MOCK_API) return apiClient.get('/products', query);  // real API
  // …mock implementation
}
```

To switch to the real backend:

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_URL=https://api.example.com` and `VITE_USE_MOCK_API=false`.
3. Build the matching endpoints on the server. The paths are listed in each service file. The request and response shapes follow `src/types`.

`services/api/client.ts` attaches the session's bearer token and normalises errors into `ApiError`.

**Payments:** `services/paymentService.ts` defines a `PaymentProvider` interface. Right now a mock provider is active. To use Stripe or a local mobile-money gateway, implement `authorize()` with the provider's SDK or hosted fields. Card data only ever lives in component state. It is never persisted and never sent to the SPORTX API.

### State and persistence

| State                    | Where                          |
| ------------------------ | ------------------------------ |
| Cart, coupon             | `localStorage` (`sportx.cart`) |
| Wishlist                 | `localStorage`. Merged into the account on sign-in (`WishlistSync`) |
| Auth session             | `localStorage` if "Remember me" is ticked, otherwise `sessionStorage` |
| Recently viewed, searches | `localStorage`                |
| Checkout progress        | `sessionStorage`               |
| Mock backend tables      | `localStorage` (`sportx.mock-db`) |

To reset all demo data, clear the site's storage in DevTools.

### Catalog filters

Filters, sorting and pagination are stored in the URL (for example `/football?category=football-boots&size=42&sort=price-asc`). That makes every filtered view shareable, and the back button works as expected. `useCatalogParams` is the single source of truth for them.

---

## Configuration

| File                         | What it controls                                                        |
| ---------------------------- | ----------------------------------------------------------------------- |
| `constants/site.ts`          | Brand name, tagline, address, phone, social links                       |
| `constants/commerce.ts`      | Currency (DJF), free-delivery threshold, shipping methods, cities, limits |
| `tailwind.config.js`         | Design tokens: colours, type scale, shadows, animations                  |
| `src/index.css`              | Component primitives (`.btn-*`, `.input`, `.heading-*`, `.skeleton`)    |

**Placeholders to confirm before launch:**

- Free-delivery threshold, shipping prices and delivery times in `commerce.ts`
- Social profile URLs in `site.ts`
- The legal pages. They are clearly marked as drafts in `pages/Legal`.
- Product photography. The current images are Unsplash development images, and some of them show third-party brand logos. Replace them with SPORTX-owned photography.
- The map. `/contact` has a map placeholder that is ready for a Google Maps or Mapbox embed.

---

## Routes

`/` · `/shop` · `/men` · `/women` · `/kids` · `/football` · `/basketball` · `/running` · `/training` · `/equipment` · `/new-arrivals` · `/sale` · `/categories` · `/categories/:slug` · `/search?q=` · `/product/:slug` · `/cart` · `/checkout` · `/order-confirmation/:orderId` · `/wishlist` · `/login` · `/register` · `/forgot-password` · `/reset-password` · `/account` · `/account/orders` · `/account/orders/:id` · `/account/wishlist` · `/account/addresses` · `/account/reviews` · `/account/payments` · `/account/support` · `/account/support/:id` · `/account/settings` · `/about` · `/contact` · `/faq` · `/privacy` · `/terms` · `/shipping` · `/returns` · 404

`/account/*` requires sign-in. Visitors who aren't signed in are sent to the login page and brought back afterwards.

## Deployment note

This is a single-page app. Configure the host to serve `index.html` for all unknown paths (SPA fallback) so that deep links work.
