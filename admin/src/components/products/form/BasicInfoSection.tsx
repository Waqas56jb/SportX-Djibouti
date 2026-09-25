import { Link2, Loader2, RefreshCw, Wand2 } from 'lucide-react';
import type { Brand, Category, ProductStatus } from '@/types';
import { FormGrid, FormSection, Input, Select } from '@/components/forms';
import { GENDERS, PRODUCT_TYPES, SPORTS } from '@/constants/catalog';
import { categoryOptions } from '@/components/catalog/categoryTree';
import { slugify } from '@/utils/format';
import type { FormErrors, ProductDraft, SetDraft } from './model';

const STATUS_OPTS: { value: ProductStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

export function BasicInfoSection({
  draft,
  set,
  errors,
  brands,
  categories,
  slugLocked,
  onSlugLockedChange,
  checking,
  onCheckUnique,
}: {
  draft: ProductDraft;
  set: SetDraft;
  errors: FormErrors;
  brands: Brand[];
  categories: Category[];
  /** True once the slug has been edited manually (stops auto-generation). */
  slugLocked: boolean;
  onSlugLockedChange: (v: boolean) => void;
  checking: { slug: boolean; sku: boolean };
  onCheckUnique: (field: 'slug' | 'sku') => void;
}) {
  const suggestSku = () => {
    const brand = brands.find((b) => b.id === draft.brandId)?.name ?? 'SPX';
    const words = draft.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase());
    set('sku', [brand.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase(), ...words].filter(Boolean).join('-'));
  };

  return (
    <FormSection id="basic" title="Basic information" description="How the product is identified and organised in the catalogue.">
      <Input
        label="Product name"
        required
        value={draft.name}
        maxLength={120}
        error={errors.name}
        placeholder="e.g. Predator Elite Firm Ground Boots"
        onChange={(e) => {
          set('name', e.target.value);
          if (!slugLocked) set('slug', slugify(e.target.value));
        }}
        onBlur={() => !slugLocked && draft.slug && onCheckUnique('slug')}
      />
      <FormGrid>
        <Input
          label="URL slug"
          required
          value={draft.slug}
          error={errors.slug}
          icon={Link2}
          inputClassName="font-mono text-[0.8125rem]"
          help={draft.slug ? `sportx.dj/products/${draft.slug}` : 'Generated from the name.'}
          aside={
            checking.slug ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" aria-hidden /> Checking…
              </span>
            ) : slugLocked ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-950"
                onClick={() => {
                  onSlugLockedChange(false);
                  set('slug', slugify(draft.name));
                }}
              >
                <RefreshCw size={12} aria-hidden /> Regenerate
              </button>
            ) : (
              'Auto'
            )
          }
          onChange={(e) => {
            onSlugLockedChange(true);
            set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'));
          }}
          onBlur={() => draft.slug && onCheckUnique('slug')}
        />
        <Input
          label="SKU"
          required
          value={draft.sku}
          error={errors.sku}
          inputClassName="font-mono uppercase text-[0.8125rem]"
          placeholder="e.g. ADI-PRED-ELITE"
          help="Base SKU. Variant SKUs are built from it."
          aside={
            checking.sku ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" aria-hidden /> Checking…
              </span>
            ) : (
              <button type="button" onClick={suggestSku} disabled={!draft.name} className="inline-flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-950 disabled:opacity-40">
                <Wand2 size={12} aria-hidden /> Suggest
              </button>
            )
          }
          onChange={(e) => set('sku', e.target.value.toUpperCase().replace(/\s+/g, '-'))}
          onBlur={() => draft.sku && onCheckUnique('sku')}
        />
      </FormGrid>
      <FormGrid>
        <Select
          label="Brand"
          required
          placeholder="Select brand…"
          value={draft.brandId}
          error={errors.brandId}
          options={brands.map((b) => ({ value: b.id, label: b.status === 'inactive' ? `${b.name} (inactive)` : b.name }))}
          onChange={(e) => set('brandId', e.target.value)}
        />
        <Select label="Category" required placeholder="Select category…" value={draft.categoryId} error={errors.categoryId} options={categoryOptions(categories)} onChange={(e) => set('categoryId', e.target.value)} />
      </FormGrid>
      <FormGrid cols={3}>
        <Select label="Sport" required placeholder="Select…" value={draft.sport} error={errors.sport} options={SPORTS} onChange={(e) => set('sport', e.target.value as ProductDraft['sport'])} />
        <Select label="Gender" required placeholder="Select…" value={draft.gender} error={errors.gender} options={GENDERS} onChange={(e) => set('gender', e.target.value as ProductDraft['gender'])} />
        <Select label="Product type" required placeholder="Select…" value={draft.type} error={errors.type} options={PRODUCT_TYPES} onChange={(e) => set('type', e.target.value as ProductDraft['type'])} />
      </FormGrid>
      <FormGrid>
        <Select label="Status" value={draft.status} options={STATUS_OPTS} onChange={(e) => set('status', e.target.value as ProductStatus)} help="You can also change this in Publishing." />
      </FormGrid>
    </FormSection>
  );
}
