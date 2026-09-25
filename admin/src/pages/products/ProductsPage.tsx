import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, Copy, Download, Eye, FolderTree, Package, Pencil, Plus, Send, Trash2, Upload, Undo2 } from 'lucide-react';
import type { ProductListItem } from '@/types';
import { brandService, categoryService, productService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePermissions } from '@/hooks/usePermission';
import { useDebounce } from '@/hooks/misc';
import { Button, EmptyState, Menu, PageHeader } from '@/components/common';
import { FilterSelect, SearchInput } from '@/components/forms';
import { BulkButton, ClearFiltersButton, DataTable } from '@/components/tables';
import { categoryOptions } from '@/components/catalog/categoryTree';
import { productColumns } from '@/components/products/productColumns';
import { ImportProductsModal } from '@/components/products/ImportProductsModal';
import { ChangeCategoryModal } from '@/components/products/ChangeCategoryModal';
import { useProductActions } from '@/components/products/useProductActions';
import {
  PRICE_RANGES,
  PRODUCT_CSV,
  PRODUCT_FILTER_DEFAULTS,
  SORT_PRESETS,
  STATUS_OPTIONS,
  STOCK_OPTIONS,
  parseSort,
  serializeSort,
  toServiceFilters,
} from '@/components/products/productListConfig';
import { GENDERS, SPORTS } from '@/constants/catalog';
import { toast } from '@/store/toastStore';
import { exportCsv } from '@/utils/csv';

export default function ProductsPage() {
  const navigate = useNavigate();
  const can = usePermissions();
  const { filters, setFilter, resetFilters, activeCount } = useUrlFilters(PRODUCT_FILTER_DEFAULTS);
  const { filters: sortParam, setFilter: setSortParam } = useUrlFilters({ sort: '' });
  const search = useDebounce(filters.search, 250);
  const [importOpen, setImportOpen] = useState(false);
  const [moveIds, setMoveIds] = useState<{ ids: string[]; clear: () => void } | null>(null);

  const sort = parseSort(sortParam.sort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const filterKey = JSON.stringify(toServiceFilters(filters, search, sort));
  // New filters / sort → back to the first page.
  useEffect(() => setPage(1), [filterKey]);
  const serviceFilters = toServiceFilters(filters, search, sort, page, pageSize);
  const { data: pageData, loading, error, reload } = useAsync(() => productService.listProducts(serviceFilters), [JSON.stringify(serviceFilters)]);
  const [exporting, setExporting] = useState(false);
  const { data: categories } = useAsync(() => categoryService.getCategories(), []);
  const { data: brands } = useAsync(() => brandService.getBrands(), []);

  const rows = pageData?.data;
  const total = pageData?.pagination.total ?? 0;
  const refresh = () => void reload(true);
  const actions = useProductActions(refresh);

  const categoryOpts = useMemo(() => categoryOptions(categories ?? []), [categories]);
  const brandOpts = useMemo(() => (brands ?? []).map((b) => ({ value: b.id, label: b.name })), [brands]);
  const filterCount = activeCount + (filters.search ? 1 : 0);
  const sortOptions = SORT_PRESETS.filter((p) => p.value).map((p) => ({ value: p.value, label: p.label }));
  if (sortParam.sort && !SORT_PRESETS.some((p) => p.value === sortParam.sort)) {
    const col = productColumns.find((c) => c.id === sort.id);
    sortOptions.push({ value: sortParam.sort, label: `${col?.label ?? (typeof col?.header === 'string' ? col.header : sort.id)} ${sort.dir === 'asc' ? '↑' : '↓'}` });
  }

  const rowActions = (p: ProductListItem) => (
    <Menu
      label={`Actions for ${p.name}`}
      items={[
        { label: 'View', icon: Eye, onSelect: () => navigate(`/products/${p.id}`) },
        { label: 'Edit', icon: Pencil, onSelect: () => navigate(`/products/${p.id}/edit`), hidden: !can('products:edit') },
        { label: 'Duplicate', icon: Copy, onSelect: () => void actions.duplicate(p.id), hidden: !can('products:create') },
        { label: 'Archive', icon: Archive, onSelect: () => void actions.setStatus([p.id], 'archived'), hidden: !can('products:edit') || p.status === 'archived' },
        { label: 'Restore to draft', icon: Undo2, onSelect: () => void actions.setStatus([p.id], 'draft'), hidden: !can('products:edit') || p.status !== 'archived' },
        { label: 'Delete', icon: Trash2, danger: true, separator: true, onSelect: () => void actions.remove(p.id, p.name), hidden: !can('products:delete') },
      ]}
    />
  );

  const bulkActions = (ids: string[], clear: () => void) => {
    const selectedRows = (rows ?? []).filter((r) => ids.includes(r.id));
    const run = async (p: Promise<boolean>) => (await p) && clear();
    return (
      <>
        {can('products:edit') && (
          <>
            <BulkButton icon={Send} onClick={() => void run(actions.setStatus(ids, 'published'))}>
              Publish
            </BulkButton>
            <BulkButton icon={Undo2} onClick={() => void run(actions.setStatus(ids, 'draft'))}>
              Unpublish
            </BulkButton>
            <BulkButton icon={Archive} onClick={() => void run(actions.setStatus(ids, 'archived'))}>
              Archive
            </BulkButton>
            <BulkButton icon={FolderTree} onClick={() => setMoveIds({ ids, clear })}>
              Change category
            </BulkButton>
          </>
        )}
        {can('products:export') && (
          <BulkButton icon={Download} onClick={() => exportCsv('products-selected', selectedRows, PRODUCT_CSV)}>
            Export selected
          </BulkButton>
        )}
        {can('products:delete') && (
          <BulkButton icon={Trash2} danger onClick={() => void run(actions.removeMany(ids))}>
            Delete
          </BulkButton>
        )}
      </>
    );
  };

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage the SPORTX catalogue — pricing, variants, stock and publishing."
        actions={
          <>
            {can('products:create') && (
              <Button icon={Upload} onClick={() => setImportOpen(true)}>
                IMPORT
              </Button>
            )}
            {can('products:export') && (
              <Button
                icon={Download}
                disabled={!total}
                loading={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    const all = await productService.getProducts(toServiceFilters(filters, search, sort));
                    exportCsv('products', all, PRODUCT_CSV);
                    toast.success(`Exported ${all.length} products.`);
                  } catch (e) {
                    toast.error('Could not export products.', { description: e instanceof Error ? e.message : undefined });
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                EXPORT
              </Button>
            )}
            {can('products:create') && (
              <Button variant="primary" icon={Plus} onClick={() => navigate('/products/new')}>
                ADD PRODUCT
              </Button>
            )}
          </>
        }
      />

      <DataTable
        caption="Products"
        storageKey="products"
        data={rows}
        columns={productColumns}
        getRowId={(p) => p.id}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        onRowClick={(p) => navigate(`/products/${p.id}`)}
        selectable
        bulkActions={bulkActions}
        rowActions={rowActions}
        sort={sort}
        onSortChange={(s) => setSortParam('sort', serializeSort(s))}
        serverPagination={{ page, pageSize, total, onPageChange: setPage, onPageSizeChange: (n) => { setPageSize(n); setPage(1); } }}
        toolbar={
          <>
            <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search name, SKU, brand…" label="Search products" className="w-full sm:w-64" />
            <FilterSelect label="Category" value={filters.category} onChange={(v) => setFilter('category', v)} options={categoryOpts} />
            <FilterSelect label="Brand" value={filters.brand} onChange={(v) => setFilter('brand', v)} options={brandOpts} />
            <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} options={STATUS_OPTIONS} />
            <FilterSelect label="Stock" value={filters.stock} onChange={(v) => setFilter('stock', v)} options={STOCK_OPTIONS} />
            <FilterSelect label="Sport" value={filters.sport} onChange={(v) => setFilter('sport', v)} options={SPORTS} />
            <FilterSelect label="Gender" value={filters.gender} onChange={(v) => setFilter('gender', v)} options={GENDERS} />
            <FilterSelect label="Price" value={filters.price} onChange={(v) => setFilter('price', v)} options={PRICE_RANGES.map((r) => ({ value: r.value, label: r.label }))} />
            <ClearFiltersButton count={filterCount} onClear={resetFilters} />
          </>
        }
        toolbarRight={<FilterSelect label="Sort" allLabel="Newest" value={sortParam.sort} onChange={(v) => setSortParam('sort', v)} options={sortOptions} />}
        empty={
          <EmptyState
            icon={Package}
            title="No products found."
            description={filterCount ? 'No products match the current search and filters.' : 'Start building the catalogue by adding your first product.'}
            secondaryAction={
              filterCount ? (
                <Button size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
            action={
              can('products:create') ? (
                <Button size="sm" variant="primary" icon={Plus} onClick={() => navigate('/products/new')}>
                  Add Product
                </Button>
              ) : undefined
            }
          />
        }
      />

      <ImportProductsModal open={importOpen} onClose={() => setImportOpen(false)} />
      <ChangeCategoryModal
        open={Boolean(moveIds)}
        count={moveIds?.ids.length ?? 0}
        categories={categories ?? []}
        onClose={() => setMoveIds(null)}
        onConfirm={async (categoryId) => {
          if (!moveIds) return;
          try {
            await productService.bulkChangeCategory(moveIds.ids, categoryId);
            toast.success(`${moveIds.ids.length} product${moveIds.ids.length === 1 ? '' : 's'} moved.`);
            moveIds.clear();
            setMoveIds(null);
            refresh();
          } catch (e) {
            toast.error('Could not change category.', { description: e instanceof Error ? e.message : undefined });
          }
        }}
      />
    </>
  );
}
