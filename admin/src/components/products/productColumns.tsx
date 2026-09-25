import type { ProductListItem } from '@/types';
import type { Column } from '@/components/tables';
import { ProductThumb, StatusBadge } from '@/components/common';
import { PRODUCT_STATUS, STOCK_STATUS } from '@/constants/status';
import { SPORTS, labelOf } from '@/constants/catalog';
import { formatDateTime, formatNumber, formatRelative } from '@/utils/format';
import { PriceTag } from './PriceTag';
import { SORT_ACCESSORS } from './productListConfig';

const mainImage = (p: ProductListItem) => (p.image ? { url: p.image } : p.images.find((i) => i.role === 'main') ?? p.images[0]);

export const productColumns: Column<ProductListItem>[] = [
  {
    id: 'image',
    header: <span className="sr-only">Image</span>,
    label: 'Image',
    cell: (p) => <ProductThumb src={mainImage(p)?.url} alt={p.name} size={44} />,
    className: 'w-[60px]',
    hideable: false,
    mobile: 'hidden',
  },
  {
    id: 'product',
    header: 'Product',
    sortValue: SORT_ACCESSORS.product,
    hideable: false,
    mobile: 'title',
    cell: (p) => (
      <div className="min-w-0 max-w-[320px]">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-zinc-900">{p.name}</span>
          {p.featured && <span className="shrink-0 rounded bg-volt px-1 text-[10px] font-bold uppercase tracking-wide text-ink-950">Featured</span>}
        </div>
        <div className="mt-0.5 truncate text-xs text-zinc-500">
          {p.brandName} · {labelOf(SPORTS, p.sport)}
        </div>
      </div>
    ),
  },
  {
    id: 'sku',
    header: 'SKU',
    mobile: 'subtitle',
    cell: (p) => <span className="whitespace-nowrap font-mono text-xs text-zinc-600">{p.sku}</span>,
  },
  { id: 'category', header: 'Category', cell: (p) => <span className="text-zinc-700">{p.categoryName}</span> },
  {
    id: 'price',
    header: 'Price',
    align: 'right',
    sortValue: SORT_ACCESSORS.price,
    mobile: 'aside',
    cell: (p) => <PriceTag price={p.price} compareAt={p.compareAtPrice} />,
  },
  {
    id: 'stock',
    header: 'Stock',
    sortValue: SORT_ACCESSORS.stock,
    cell: (p) => (
      <div className="flex items-center gap-2">
        <span className="w-9 text-right font-medium tabular text-zinc-900">{formatNumber(p.totalStock)}</span>
        <StatusBadge map={STOCK_STATUS} value={p.stockStatus} />
      </div>
    ),
  },
  { id: 'status', header: 'Status', mobile: 'aside', cell: (p) => <StatusBadge map={PRODUCT_STATUS} value={p.status} /> },
  {
    id: 'updated',
    header: 'Updated',
    sortValue: SORT_ACCESSORS.updated,
    cell: (p) => (
      <time dateTime={p.updatedAt} title={formatDateTime(p.updatedAt)} className="whitespace-nowrap text-zinc-500">
        {formatRelative(p.updatedAt)}
      </time>
    ),
  },
  { id: 'sales', header: 'Sold', label: 'Units sold', align: 'right', sortValue: SORT_ACCESSORS.sales, defaultHidden: true, cell: (p) => <span className="tabular">{formatNumber(p.unitsSold)}</span> },
];
