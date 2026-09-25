import { useEffect, useState } from 'react';
import type { Category, CategoryInput } from '@/types';
import { Drawer } from '@/components/modals/Overlay';
import { Button, Divider } from '@/components/common';
import { FormGrid, Input, Select, Textarea, Toggle } from '@/components/forms';
import { slugify } from '@/utils/format';
import { isSlug } from '@/utils/validation';
import { categoryOptions, descendantIds } from './categoryTree';
import { ImageUploadField } from './ImageUploadField';

type Draft = Omit<CategoryInput, 'position'>;

const blank = (parentId: string | null): Draft => ({ name: '', slug: '', description: '', imageUrl: undefined, parentId, status: 'active', seoTitle: '', seoDescription: '' });

/** Create / edit a category. `category` undefined = create (optionally under `parentId`). */
export function CategoryDrawer({
  open,
  category,
  parentId = null,
  categories,
  onClose,
  onSubmit,
}: {
  open: boolean;
  category?: Category;
  parentId?: string | null;
  categories: Category[];
  onClose: () => void;
  onSubmit: (input: Draft) => Promise<boolean>;
}) {
  const [d, setD] = useState<Draft>(blank(null));
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSlugTouched(Boolean(category));
    setD(category ? { name: category.name, slug: category.slug, description: category.description, imageUrl: category.imageUrl, parentId: category.parentId, status: category.status, seoTitle: category.seoTitle, seoDescription: category.seoDescription } : blank(parentId));
  }, [open, category, parentId]);

  const patch = (p: Partial<Draft>) => setD((cur) => ({ ...cur, ...p }));
  const exclude = category ? descendantIds(categories, category.id) : [];

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!d.name.trim()) e.name = 'Name is required.';
    if (!d.slug.trim()) e.slug = 'Slug is required.';
    else if (!isSlug(d.slug)) e.slug = 'Use lowercase letters, numbers and single hyphens only.';
    else if (categories.some((c) => c.slug === d.slug && c.id !== category?.id)) e.slug = 'Another category already uses this slug.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const ok = await onSubmit({ ...d, name: d.name.trim(), description: d.description.trim(), seoTitle: d.seoTitle.trim(), seoDescription: d.seoDescription.trim() });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={category ? 'Edit category' : 'New category'}
      description={category ? `${category.productCount} products in this category` : 'Categories organise the storefront navigation and filters.'}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            {category ? 'Save changes' : 'Create category'}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormGrid>
          <Input
            label="Name"
            required
            value={d.name}
            error={errors.name}
            data-autofocus
            onChange={(e) => patch({ name: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })}
          />
          <Input
            label="Slug"
            required
            value={d.slug}
            error={errors.slug}
            inputClassName="font-mono text-[0.8125rem]"
            onChange={(e) => {
              setSlugTouched(true);
              patch({ slug: e.target.value.toLowerCase().replace(/\s+/g, '-') });
            }}
          />
        </FormGrid>
        <Select
          label="Parent category"
          value={d.parentId ?? ''}
          placeholder="None (top level)"
          options={categoryOptions(categories, { exclude })}
          onChange={(e) => patch({ parentId: e.target.value || null })}
        />
        <Textarea label="Description" rows={3} value={d.description} onChange={(e) => patch({ description: e.target.value })} />
        <ImageUploadField label="Category image" value={d.imageUrl} onChange={(url, file) => patch({ imageUrl: url, imageFile: file })} hint="Landscape works best · PNG, JPG or WEBP" />
        <div className="rounded-xl border border-zinc-200 p-4">
          <Toggle checked={d.status === 'active'} onChange={(on) => patch({ status: on ? 'active' : 'inactive' })} label="Active" description="Inactive categories are hidden from the storefront navigation." />
        </div>
        <Divider label="SEO" />
        <Input label="SEO title" value={d.seoTitle} maxLength={60} aside={<span className="tabular">{d.seoTitle.length}/60</span>} placeholder={d.name ? `${d.name} | SPORTX Djibouti` : undefined} onChange={(e) => patch({ seoTitle: e.target.value })} />
        <Textarea label="SEO description" rows={3} maxLength={160} showCount value={d.seoDescription} onChange={(e) => patch({ seoDescription: e.target.value })} />
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
