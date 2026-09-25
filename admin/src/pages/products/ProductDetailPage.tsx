import { useNavigate, useParams, Link } from 'react-router-dom';
import { Archive, ChevronDown, Copy, History, Pencil, Trash2, Undo2, Send } from 'lucide-react';
import { productService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { usePermissions } from '@/hooks/usePermission';
import { Badge, Button, DescriptionList, Menu, PageHeader, Panel, ProductThumb, Skeleton, SkeletonPanel, StatusBadge } from '@/components/common';
import { PRODUCT_STATUS, STOCK_STATUS } from '@/constants/status';
import { GENDERS, PRODUCT_TYPES, SPORTS, labelOf } from '@/constants/catalog';
import { formatDate, formatDateTime, formatNumber } from '@/utils/format';
import { useProductActions } from '@/components/products/useProductActions';
import { ProductLoadError } from '@/components/products/ProductStates';
import { ProductGallery } from '@/components/products/detail/ProductGallery';
import { VariantStockTable } from '@/components/products/detail/VariantStockTable';
import { PerformanceStats, PricingSummary } from '@/components/products/detail/DetailPanels';
import { SearchPreview } from '@/components/products/SearchPreview';

export default function ProductDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const can = usePermissions();
  const { data: p, loading, error, reload } = useAsync(() => productService.getProduct(id), [id]);
  const actions = useProductActions(() => void reload(true));

  if (loading)
    return (
      <div aria-busy="true" aria-label="Loading product">
        <Skeleton className="mb-3 h-3 w-24" />
        <div className="mb-8 flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-xl" />
          <Skeleton className="h-7 w-72" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <SkeletonPanel rows={10} />
          <SkeletonPanel rows={6} />
        </div>
      </div>
    );
  if (error || !p) return <ProductLoadError error={error ?? new Error('Not found')} onRetry={() => void reload()} />;

  const main = p.images.find((i) => i.role === 'main') ?? p.images[0];

  return (
    <>
      <PageHeader
        backTo="/products"
        backLabel="Products"
        documentTitle={p.name}
        title={
          <span className="flex items-center gap-4">
            <ProductThumb src={main?.url} alt={p.name} size={56} className="rounded-xl" />
            <span className="min-w-0">{p.name}</span>
          </span>
        }
        meta={
          <>
            <StatusBadge map={PRODUCT_STATUS} value={p.status} size="md" />
            <StatusBadge map={STOCK_STATUS} value={p.stockStatus} size="md" />
            {p.featured && (
              <Badge tone="brand" size="md" dot>
                Featured
              </Badge>
            )}
            <span className="font-mono text-xs text-zinc-500">SKU {p.sku}</span>
          </>
        }
        actions={
          <>
            {can('products:create') && (
              <Button icon={Copy} onClick={() => void actions.duplicate(p.id)}>
                Duplicate
              </Button>
            )}
            {can('products:edit') && (
              <Button variant="primary" icon={Pencil} onClick={() => navigate(`/products/${p.id}/edit`)}>
                Edit product
              </Button>
            )}
            <Menu
              label="More actions"
              trigger={(t) => (
                <Button {...t} iconRight={ChevronDown}>
                  More
                </Button>
              )}
              items={[
                { label: 'Publish', icon: Send, onSelect: () => void actions.setStatus([p.id], 'published'), hidden: !can('products:edit') || p.status === 'published' },
                { label: 'Archive', icon: Archive, onSelect: () => void actions.setStatus([p.id], 'archived'), hidden: !can('products:edit') || p.status === 'archived' },
                { label: 'Restore to draft', icon: Undo2, onSelect: () => void actions.setStatus([p.id], 'draft'), hidden: !can('products:edit') || p.status !== 'archived' },
                { label: 'View stock history', icon: History, onSelect: () => navigate(`/inventory/movements?product=${p.id}`) },
                {
                  label: 'Delete',
                  icon: Trash2,
                  danger: true,
                  separator: true,
                  hidden: !can('products:delete'),
                  onSelect: () => void actions.remove(p.id, p.name).then((ok) => ok && navigate('/products')),
                },
              ]}
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Panel>
            <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <ProductGallery images={p.images} name={p.name} />
              <div className="min-w-0 space-y-5">
                {p.shortDescription && <p className="text-[0.9375rem] leading-relaxed text-zinc-700">{p.shortDescription}</p>}
                <DescriptionList
                  columns={2}
                  items={[
                    { label: 'Brand', value: p.brandName },
                    { label: 'Category', value: <Link className="font-medium hover:underline" to={`/products?category=${p.categoryId}`}>{p.categoryName}</Link> },
                    { label: 'Sport', value: labelOf(SPORTS, p.sport) },
                    { label: 'Gender', value: labelOf(GENDERS, p.gender) },
                    { label: 'Product type', value: labelOf(PRODUCT_TYPES, p.type) },
                    { label: 'Total stock', value: <span className="tabular">{formatNumber(p.totalStock)} units</span> },
                    { label: 'Published', value: p.publishedAt ? formatDate(p.publishedAt) : 'Not published' },
                    { label: 'Last updated', value: formatDateTime(p.updatedAt) },
                  ]}
                />
                {p.tags.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-zinc-500">Tags</div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.tags.map((t) => (
                        <span key={t} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <PerformanceStats p={p} />

          <Panel
            flush
            title="Variants"
            description={`${p.variants.length} variants · ${formatNumber(p.totalStock)} units on hand`}
            actions={
              <Button size="sm" variant="ghost" icon={History} onClick={() => navigate(`/inventory/movements?product=${p.id}`)}>
                Stock history
              </Button>
            }
          >
            <VariantStockTable variants={p.variants} basePrice={p.price} />
          </Panel>

          <Panel title="Description & specifications">
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="whitespace-pre-line text-[0.8125rem] leading-relaxed text-zinc-700">{p.description || <span className="text-zinc-400">No description yet.</span>}</div>
              {p.specs.length > 0 ? (
                <dl className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-[0.8125rem]">
                  {p.specs.map((s, i) => (
                    <div key={i} className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 px-4 py-2.5">
                      <dt className="font-medium text-zinc-500">{s.label}</dt>
                      <dd className="text-zinc-900">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-[0.8125rem] text-zinc-400">No specifications yet.</p>
              )}
            </div>
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6">
          <PricingSummary p={p} />
          <Panel title="Search appearance" description={p.seo.keywords.length ? `Keywords: ${p.seo.keywords.join(', ')}` : undefined}>
            <SearchPreview title={p.seo.title || p.name} description={p.seo.description || p.shortDescription} slug={p.slug} />
          </Panel>
        </aside>
      </div>
    </>
  );
}
