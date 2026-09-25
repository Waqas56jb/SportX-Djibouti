import type { ProductFilters, ProductListItem, ProductStatus, StockStatus, Sport, Gender } from '@/types';
import type { SortState } from '@/components/tables';
import type { CsvColumn } from '@/utils/csv';
import { PRODUCT_STATUS, STOCK_STATUS } from '@/constants/status';
import { GENDERS, SPORTS, labelOf } from '@/constants/catalog';

export const PRODUCT_FILTER_DEFAULTS = {
  search: '',
  category: '',
  brand: '',
  status: '',
  stock: '',
  sport: '',
  gender: '',
  price: '',
};
export type ProductUrlFilters = typeof PRODUCT_FILTER_DEFAULTS;

export const PRICE_RANGES = [
  { value: 'lt10', label: 'Under 10k', min: undefined, max: 9_999 },
  { value: '10to25', label: '10k – 25k', min: 10_000, max: 25_000 },
  { value: 'gt25', label: '25k +', min: 25_001, max: undefined },
] as const;

export const STOCK_OPTIONS = (Object.keys(STOCK_STATUS) as StockStatus[]).map((k) => ({ value: k, label: STOCK_STATUS[k].label }));
export const STATUS_OPTIONS = (Object.keys(PRODUCT_STATUS) as ProductStatus[]).map((k) => ({ value: k, label: PRODUCT_STATUS[k].label }));

/** Maps URL filter strings onto the service filter contract. */
export function toServiceFilters(f: ProductUrlFilters, search: string): ProductFilters {
  const range = PRICE_RANGES.find((r) => r.value === f.price);
  return {
    search: search || undefined,
    categoryId: f.category || undefined,
    brandId: f.brand || undefined,
    status: (f.status || '') as ProductStatus | '',
    stock: (f.stock || '') as StockStatus | '',
    sport: (f.sport || '') as Sport | '',
    gender: (f.gender || '') as Gender | '',
    minPrice: range?.min,
    maxPrice: range?.max,
  };
}

// ─── Sorting ────────────────────────────────────────────────────────────────
export const SORT_ACCESSORS: Record<string, (p: ProductListItem) => string | number> = {
  product: (p) => p.name.toLowerCase(),
  sku: (p) => p.sku,
  category: (p) => p.categoryName,
  price: (p) => p.price,
  stock: (p) => p.totalStock,
  status: (p) => p.status,
  updated: (p) => p.updatedAt,
  created: (p) => p.createdAt,
  sales: (p) => p.unitsSold,
};

/** Preset sort options for the toolbar select. '' is the default (newest). */
export const SORT_PRESETS: { value: string; label: string; sort: SortState }[] = [
  { value: '', label: 'Newest', sort: { id: 'created', dir: 'desc' } },
  { value: 'created:asc', label: 'Oldest', sort: { id: 'created', dir: 'asc' } },
  { value: 'price:asc', label: 'Price ↑', sort: { id: 'price', dir: 'asc' } },
  { value: 'price:desc', label: 'Price ↓', sort: { id: 'price', dir: 'desc' } },
  { value: 'stock:asc', label: 'Stock (lowest)', sort: { id: 'stock', dir: 'asc' } },
  { value: 'sales:desc', label: 'Best selling', sort: { id: 'sales', dir: 'desc' } },
];

export function parseSort(v: string): SortState {
  const preset = SORT_PRESETS.find((p) => p.value === v);
  if (preset) return preset.sort;
  const [id, dir] = v.split(':');
  if (id && SORT_ACCESSORS[id] && (dir === 'asc' || dir === 'desc')) return { id, dir };
  return SORT_PRESETS[0].sort;
}

export const serializeSort = (s: SortState) => {
  const preset = SORT_PRESETS.find((p) => p.sort.id === s.id && p.sort.dir === s.dir);
  return preset ? preset.value : `${s.id}:${s.dir}`;
};

export function sortProducts(rows: ProductListItem[], s: SortState): ProductListItem[] {
  const get = SORT_ACCESSORS[s.id];
  if (!get) return rows;
  const out = [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
  });
  return s.dir === 'desc' ? out.reverse() : out;
}

// ─── Export ─────────────────────────────────────────────────────────────────
export const PRODUCT_CSV: CsvColumn<ProductListItem>[] = [
  { header: 'Name', value: (p) => p.name },
  { header: 'SKU', value: (p) => p.sku },
  { header: 'Brand', value: (p) => p.brandName },
  { header: 'Category', value: (p) => p.categoryName },
  { header: 'Sport', value: (p) => labelOf(SPORTS, p.sport) },
  { header: 'Gender', value: (p) => labelOf(GENDERS, p.gender) },
  { header: 'Price', value: (p) => p.price },
  { header: 'Compare-at price', value: (p) => p.compareAtPrice ?? '' },
  { header: 'Total stock', value: (p) => p.totalStock },
  { header: 'Stock status', value: (p) => STOCK_STATUS[p.stockStatus].label },
  { header: 'Status', value: (p) => PRODUCT_STATUS[p.status].label },
  { header: 'Variants', value: (p) => p.variants.length },
  { header: 'Units sold', value: (p) => p.unitsSold },
  { header: 'Updated', value: (p) => p.updatedAt },
];
