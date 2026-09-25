import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderTree, Plus } from 'lucide-react';
import type { Category } from '@/types';
import { categoryService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { usePermissions } from '@/hooks/usePermission';
import { Button, EmptyState, ErrorState, PageHeader, Segmented, Skeleton } from '@/components/common';
import { SearchInput } from '@/components/forms';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { flattenTree } from '@/components/catalog/categoryTree';
import { CategoryRow } from '@/components/catalog/CategoryRow';
import { CategoryDrawer } from '@/components/catalog/CategoryDrawer';

type DrawerState = { open: false } | { open: true; category?: Category; parentId?: string | null };
const msg = (e: unknown) => (e instanceof Error ? e.message : undefined);

export default function CategoriesPage() {
  const can = usePermissions();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload, setData } = useAsync(() => categoryService.getCategories(), []);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [busy, setBusy] = useState(false);

  // Deep link: /categories?new=1 opens the create drawer.
  useEffect(() => {
    if (params.get('new') === '1' && can('categories:create')) {
      setDrawer({ open: true });
      setParams((p) => {
        const n = new URLSearchParams(p);
        n.delete('new');
        return n;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => data ?? [], [data]);
  const nodes = useMemo(() => flattenTree(categories), [categories]);
  const filtering = Boolean(q.trim()) || status !== 'all';
  const visible = nodes.filter((n) => {
    const c = n.category;
    if (status !== 'all' && c.status !== status) return false;
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    return c.name.toLowerCase().includes(t) || c.slug.includes(t) || Boolean(n.parent?.name.toLowerCase().includes(t));
  });
  const childCount = (id: string) => categories.filter((c) => c.parentId === id).length;
  const active = categories.filter((c) => c.status === 'active').length;
  const roots = categories.filter((c) => !c.parentId).length;

  const save = async (input: Omit<Category, 'id' | 'productCount' | 'createdAt' | 'updatedAt' | 'position'>) => {
    if (!drawer.open) return false;
    try {
      if (drawer.category) {
        await categoryService.updateCategory(drawer.category.id, { ...input, position: drawer.category.position });
        toast.success('Category updated.');
      } else {
        const siblings = categories.filter((c) => c.parentId === input.parentId).length;
        await categoryService.createCategory({ ...input, position: siblings });
        toast.success('Category created.');
      }
      void reload(true);
      return true;
    } catch (e) {
      toast.error('Could not save category.', { description: msg(e) });
      return false;
    }
  };

  const toggle = async (c: Category, on: boolean) => {
    const next = on ? 'active' : 'inactive';
    setData((list) => list?.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    try {
      await categoryService.setStatus(c.id, next);
      toast.success(on ? `${c.name} enabled.` : `${c.name} disabled.`, { description: on ? undefined : 'It is now hidden from the storefront.' });
    } catch (e) {
      setData((list) => list?.map((x) => (x.id === c.id ? { ...x, status: c.status } : x)));
      toast.error('Could not change status.', { description: msg(e) });
    }
  };

  const reorder = async (siblingIds: string[], fromId: string, toIndex: number) => {
    const ids = siblingIds.filter((x) => x !== fromId);
    ids.splice(Math.max(0, Math.min(toIndex, ids.length)), 0, fromId);
    if (ids.join() === siblingIds.join()) return;
    const prev = data;
    setData((list) => list?.map((c) => (ids.includes(c.id) ? { ...c, position: ids.indexOf(c.id) } : c)));
    setBusy(true);
    try {
      await categoryService.reorder(ids);
      toast.success('Order updated.');
    } catch (e) {
      setData(prev);
      toast.error('Could not reorder categories.', { description: msg(e) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Category) => {
    const ok = await confirm({
      title: 'Delete category?',
      description: `“${c.name}” will be permanently removed. This action cannot be undone.`,
      confirmLabel: 'Delete Category',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await categoryService.deleteCategory(c.id);
      toast.success('Category deleted.');
      setData((list) => list?.filter((x) => x.id !== c.id));
    } catch (e) {
      toast.error('Could not delete category.', { description: msg(e) });
    }
  };

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise the storefront navigation. Drag or use the arrows to reorder categories within the same level."
        actions={
          can('categories:create') && (
            <Button variant="primary" icon={Plus} onClick={() => setDrawer({ open: true })}>
              ADD CATEGORY
            </Button>
          )
        }
      />

      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search categories…" label="Search categories" className="w-full sm:w-64" />
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
          {data && (
            <p className="text-[0.8125rem] text-zinc-500">
              <span className="font-semibold tabular text-zinc-900">{categories.length}</span> categories · <span className="tabular">{roots}</span> top-level · <span className="tabular">{active}</span> active
            </p>
          )}
        </div>

        {error ? (
          <ErrorState onRetry={() => void reload()} description="We couldn’t load categories. Please try again." />
        ) : loading ? (
          <ul aria-busy="true" aria-label="Loading categories">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3" style={{ paddingLeft: i % 3 === 2 ? 44 : 16 }}>
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-9 rounded-full" />
              </li>
            ))}
          </ul>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={FolderTree}
            title={filtering ? 'No categories match your filters.' : 'No categories yet.'}
            description={filtering ? 'Try a different search or status.' : 'Create your first category to start organising products.'}
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
                  Add Category
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul aria-label="Category tree">
            {visible.map((n) => (
              <CategoryRow
                key={n.category.id}
                node={n}
                childCount={childCount(n.category.id)}
                canEdit={can('categories:edit')}
                canReorder={can('categories:edit') && !filtering}
                canDelete={can('categories:delete')}
                canCreate={can('categories:create')}
                busy={busy}
                onEdit={() => setDrawer({ open: true, category: n.category })}
                onAddChild={() => setDrawer({ open: true, parentId: n.category.id })}
                onDelete={() => void remove(n.category)}
                onToggle={(on) => void toggle(n.category, on)}
                onMove={(dir) => void reorder(n.siblingIds, n.category.id, n.index + dir)}
                onDropSibling={(id) => void reorder(n.siblingIds, id, n.index)}
              />
            ))}
          </ul>
        )}
      </div>

      <CategoryDrawer
        open={drawer.open}
        category={drawer.open ? drawer.category : undefined}
        parentId={drawer.open ? drawer.parentId ?? null : null}
        categories={categories}
        onClose={() => setDrawer({ open: false })}
        onSubmit={save}
      />
    </>
  );
}
