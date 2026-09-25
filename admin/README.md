# SPORTX Admin

Internal operations platform for the SPORTX store (Djibouti). React 18 + Vite + TypeScript + Tailwind + React Router + Zustand + Recharts + Lucide.

> **Frontend phase.** All data comes from an in-memory mock layer behind the service functions. No backend, payment or shipping API is called.

```bash
npm install
npm run dev        # http://localhost:5174
npm run build      # type-check + production build
```

Demo sign-in (mock mode): any account below with password `sportx2026`.

| Role | Email |
| --- | --- |
| Super Admin | admin@sportx.demo |
| Store Manager | store.manager@sportx.demo |
| Product Manager | products@sportx.demo |
| Order Manager | orders@sportx.demo |
| Support Manager | support@sportx.demo |

## Architecture

```
src/
  types/         Domain types (the contract the Node.js API must satisfy)
  data/          Seed data for mocks only (deterministic, relative to "now")
  services/      One service per domain. UI calls ONLY these.
    mock/db.ts   In-memory DB + audit(), used by services when VITE_USE_MOCKS != 'false'
    http.ts      REST client used when mocks are off
  store/         Zustand: auth, ui (sidebar, currency, density), notifications, toast, confirm
  hooks/         useAsync, useMutation, useUrlFilters, usePermission, misc (debounce, media query, hotkey…)
  components/
    common/      Button, IconButton, Badge, StatusBadge, Panel, PageHeader, Tabs, Segmented, Menu,
                 EmptyState, ErrorState, Skeleton*, Avatar, ProductThumb, Rating, DemoBadge, Delta, Can…
    forms/       Field, Input, NumberInput, CurrencyInput, Textarea, Select, FilterSelect, SearchInput,
                 DateInput, Toggle, Checkbox, RadioGroup, MultiSelect, ColorSelector, ChipSelector, FileDropzone,
                 FormSection, FormGrid
    modals/      Modal, Drawer, ConfirmHost (use `confirm()`), ImagePreview
    tables/      DataTable (sort, paginate, select, bulk, column visibility, skeleton, empty, error, mobile cards),
                 BulkButton, ClearFiltersButton
    charts/      CHART palette, axisProps, ChartTooltipBox, ChartLegend, Sparkline, KpiCard, AttentionStat
    layout/, navigation/  App shell, sidebar, topbar, command palette (Ctrl/Cmd+K)
    <feature>/   Feature-specific components (products, orders, inventory, …)
  pages/<feature>/  Route screens (default export), lazy loaded in routes/index.tsx
  constants/     brand, navigation + route meta, permissions, status label/tone maps, catalog option lists
  utils/         format (money/date), csv export, validation, stock status, permissions, cn
```

### Moving to the real backend
Set `VITE_USE_MOCKS=false` and `VITE_API_BASE_URL`. Every service method already contains the
REST call it expects (e.g. `productService.getProducts` → `GET /products`). Replace `mock/db.ts`
usage progressively; UI code does not change.

### Security
- No secrets in the frontend. Only `VITE_*` public config is read (see `.env.example`).
- Payment credentials are write-only server-side; the UI only shows masked placeholders.
- Route/menu permission checks (`hasPermission`, `RequirePermission`, `<Can>`) are UX only —
  the API must enforce the same permissions.

## UI conventions

- **Data loading**: `const { data, loading, error, reload, setData } = useAsync(() => service.fn(filters), [deps])`.
  Never import from `src/data` or `services/mock` in UI code.
- **Mutations**: call the service, then `toast.success('Stock updated.')` / `toast.error(...)`.
  `useMutation(fn, { success: '…' })` wraps this.
- **Destructive actions**: `if (await confirm({ title: 'Delete product?', description: 'This action cannot be undone.', confirmLabel: 'Delete Product' })) …`
- **Lists**: always `DataTable` with `caption`, `getRowId`, `loading`, `error`, `onRetry`, an `EmptyState` with a CTA, and `mobile` hints on columns.
  Filters live in the URL via `useUrlFilters`.
- **Page skeleton**: `PageHeader` (title, description, actions) → content. Use `Panel` for sections.
- **Status**: `<StatusBadge map={ORDER_STATUS} value={o.status} />` — never hand-roll badge colours.
- **Money/dates**: `formatMoney`, `formatDate`, `formatDateTime`, `formatRelative`. Currency is DJF by default (configurable, not converted).
- **Permissions**: `usePermission('products:edit')`, `<Can permission="orders:approve">`.
- **Charts**: Recharts, `CHART.ink` for a single series, `CHART.compare` dashed for previous period,
  `CHART.series[i]` in fixed order for multi-series. No dual axes. Always a tooltip via `ChartTooltipBox`.
  Mark numbers as demo with `<DemoBadge />`.
- **Visual language**: neutral zinc surfaces, ink-950 for primary actions, volt (#C8F54A) as a sparing accent,
  `font-display` (Barlow Condensed) only for headline numbers. Text sizes: body 13–14px, never below 11px.
