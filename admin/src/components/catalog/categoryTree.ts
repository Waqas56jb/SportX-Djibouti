import type { Category } from '@/types';
import type { SelectOption } from '@/components/forms';

export interface CategoryNode {
  category: Category;
  depth: number;
  parent: Category | null;
  /** Ids of siblings in display order (including self). */
  siblingIds: string[];
  index: number;
}

const byPosition = (a: Category, b: Category) => a.position - b.position || a.name.localeCompare(b.name);

/** Flattens categories into display order: each parent followed by its children (any depth). */
export function flattenTree(categories: Category[]): CategoryNode[] {
  const children = new Map<string | null, Category[]>();
  const ids = new Set(categories.map((c) => c.id));
  for (const c of categories) {
    // Orphans (parent missing) are treated as roots so they never disappear.
    const key = c.parentId && ids.has(c.parentId) ? c.parentId : null;
    children.set(key, [...(children.get(key) ?? []), c]);
  }
  const out: CategoryNode[] = [];
  const walk = (parentId: string | null, depth: number, parent: Category | null) => {
    const list = [...(children.get(parentId) ?? [])].sort(byPosition);
    const siblingIds = list.map((c) => c.id);
    list.forEach((c, index) => {
      out.push({ category: c, depth, parent, siblingIds, index });
      if (depth < 6) walk(c.id, depth + 1, c);
    });
  };
  walk(null, 0, null);
  return out;
}

/** Full path label, e.g. "Football › Football Boots". */
export function categoryPath(categories: Category[], id: string | null | undefined): string {
  const parts: string[] = [];
  let cur = categories.find((c) => c.id === id);
  let guard = 0;
  while (cur && guard++ < 8) {
    parts.unshift(cur.name);
    cur = cur.parentId ? categories.find((c) => c.id === cur!.parentId) : undefined;
  }
  return parts.join(' › ');
}

/** Select options with nested labels, in tree order. */
export function categoryOptions(categories: Category[], opts: { exclude?: string[] } = {}): SelectOption[] {
  return flattenTree(categories)
    .filter((n) => !opts.exclude?.includes(n.category.id))
    .map((n) => ({ value: n.category.id, label: categoryPath(categories, n.category.id) }));
}

/** Ids of a category and all of its descendants. */
export function descendantIds(categories: Category[], id: string): string[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) for (const c of categories) if (c.parentId === out[i] && !out.includes(c.id)) out.push(c.id);
  return out;
}
