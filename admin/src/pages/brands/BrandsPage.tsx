import { useMemo, useState } from 'react';
import { Plus, Tags } from 'lucide-react';
import type { Brand, BrandInput } from '@/types';
import { brandService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { usePermissions } from '@/hooks/usePermission';
import { Button, EmptyState, ErrorState, PageHeader, Segmented, Skeleton } from '@/components/common';
import { SearchInput } from '@/components/forms';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { BrandCard } from '@/components/catalog/BrandCard';
import { BrandDrawer } from '@/components/catalog/BrandDrawer';

type DrawerState = { open: false } | { open: true; brand?: Brand };
const msg = (e: unknown) => (e instanceof Error ? e.message : undefined);

export default function BrandsPage() {
  const can = usePermissions();
  const { data, loading, error, reload, setData } = useAsync(() => brandService.getBrands(), []);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<'name' | 'products'>('name');

  const brands = useMemo(() => data ?? [], [data]);
  const filtering = Boolean(q.trim()) || status !== 'all';
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = brands.filter((b) => (status === 'all' || b.status === status) && (!t || b.name.toLowerCase().includes(t) || b.website.toLowerCase().includes(t)));
    return sort === 'products' ? [...list].sort((a, b) => b.productCount - a.productCount) : list;
  }, [brands, q, status, sort]);
  const totalProducts = brands.reduce((s, b) => s + b.productCount, 0);

  const save = async (input: BrandInput) => {
    if (!drawer.open) return false;
    try {
      if (drawer.brand) {
        await brandService.updateBrand(drawer.brand.id, input);
        toast.success('Brand updated.');
      } else {
        await brandService.createBrand(input);
        toast.success('Brand created.');
      }
      void reload(true);
      return true;
    } catch (e) {
      toast.error('Could not save brand.', { description: msg(e) });
      return false;
    }
  };

  const toggle = async (b: Brand, on: boolean) => {
    const next = on ? 'active' : 'inactive';
    setData((list) => list?.map((x) => (x.id === b.id ? { ...x, status: next } : x)));
    try {
      await brandService.setStatus(b.id, next);
      toast.success(on ? `${b.name} enabled.` : `${b.name} disabled.`);
    } catch (e) {
      setData((list) => list?.map((x) => (x.id === b.id ? { ...x, status: b.status } : x)));
      toast.error('Could not change status.', { description: msg(e) });
    }
  };

  const remove = async (b: Brand) => {
    const ok = await confirm({
      title: 'Delete brand?',
      description: b.productCount
        ? `“${b.name}” still has ${b.productCount} products. Reassign or delete them before removing the brand.`
        : `“${b.name}” will be permanently removed. This action cannot be undone.`,
      confirmLabel: 'Delete Brand',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await brandService.deleteBrand(b.id);
      setData((list) => list?.filter((x) => x.id !== b.id));
      toast.success('Brand deleted.');
    } catch (e) {
      toast.error('Could not delete brand.', { description: msg(e) });
    }
  };

  return (
    <>
      <PageHeader
        title="Brands"
        description="The brand directory used on product pages and storefront filters."
        actions={
          can('categories:create') && (
            <Button variant="primary" icon={Plus} onClick={() => setDrawer({ open: true })}>
              ADD BRAND
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search brands…" label="Search brands" className="w-full sm:w-64" />
          <Segmented
            ariaLabel="Filter by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <p className="text-[0.8125rem] text-zinc-500">
              <span className="font-semibold tabular text-zinc-900">{brands.length}</span> brands · <span className="tabular">{totalProducts}</span> products
            </p>
          )}
          <Segmented
            ariaLabel="Sort brands"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'name', label: 'A–Z' },
              { value: 'products', label: 'Most products' },
            ]}
          />
        </div>
      </div>

      {error ? (
        <div className="panel">
          <ErrorState onRetry={() => void reload()} description="We couldn’t load brands. Please try again." />
        </div>
      ) : loading ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading brands">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="panel space-y-4 p-5">
              <div className="flex gap-4">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </li>
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={Tags}
            title={filtering ? 'No brands match your filters.' : 'No brands yet.'}
            description={filtering ? 'Try a different search or status.' : 'Add the brands you stock to start assigning products.'}
            action={
              filtering ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setQ('');
                    setStatus('all');
                  }}
                >
                  Clear filters
                </Button>
              ) : can('categories:create') ? (
                <Button size="sm" variant="primary" icon={Plus} onClick={() => setDrawer({ open: true })}>
                  Add Brand
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Brands">
          {visible.map((b) => (
            <BrandCard
              key={b.id}
              brand={b}
              canEdit={can('categories:edit')}
              canDelete={can('categories:delete')}
              onEdit={() => setDrawer({ open: true, brand: b })}
              onDelete={() => void remove(b)}
              onToggle={(on) => void toggle(b, on)}
            />
          ))}
        </ul>
      )}

      <BrandDrawer open={drawer.open} brand={drawer.open ? drawer.brand : undefined} brands={brands} onClose={() => setDrawer({ open: false })} onSubmit={save} />
    </>
  );
}
