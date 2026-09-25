import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import type { Brand, BrandInput } from '@/types';
import { Drawer } from '@/components/modals/Overlay';
import { Button } from '@/components/common';
import { FormGrid, Input, Textarea, Toggle } from '@/components/forms';
import { slugify } from '@/utils/format';
import { isSlug, isUrl } from '@/utils/validation';
import { ImageUploadField } from './ImageUploadField';
import { BrandLogo } from './BrandLogo';

const blank = (): BrandInput => ({ name: '', slug: '', logoUrl: undefined, description: '', website: '', status: 'active' });

export function BrandDrawer({ open, brand, brands, onClose, onSubmit }: { open: boolean; brand?: Brand; brands: Brand[]; onClose: () => void; onSubmit: (input: BrandInput) => Promise<boolean> }) {
  const [d, setD] = useState<BrandInput>(blank);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSlugTouched(Boolean(brand));
    setD(brand ? { name: brand.name, slug: brand.slug, logoUrl: brand.logoUrl, description: brand.description, website: brand.website, status: brand.status } : blank());
  }, [open, brand]);

  const patch = (p: Partial<BrandInput>) => setD((cur) => ({ ...cur, ...p }));

  const submit = async () => {
    const e: Record<string, string> = {};
    const website = d.website.trim() && !/^https?:\/\//i.test(d.website.trim()) ? `https://${d.website.trim()}` : d.website.trim();
    if (!d.name.trim()) e.name = 'Brand name is required.';
    else if (brands.some((b) => b.id !== brand?.id && b.name.toLowerCase() === d.name.trim().toLowerCase())) e.name = 'A brand with this name already exists.';
    if (!d.slug) e.slug = 'Slug is required.';
    else if (!isSlug(d.slug)) e.slug = 'Use lowercase letters, numbers and single hyphens only.';
    else if (brands.some((b) => b.id !== brand?.id && b.slug === d.slug)) e.slug = 'Another brand already uses this slug.';
    if (website && !isUrl(website)) e.website = 'Enter a valid URL, e.g. https://www.nike.com';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const ok = await onSubmit({ ...d, name: d.name.trim(), description: d.description.trim(), website });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="md"
      dismissible={!saving}
      title={brand ? 'Edit brand' : 'New brand'}
      description={brand ? `${brand.productCount} products linked to this brand` : 'Brands appear on product pages and in storefront filters.'}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            {brand ? 'Save changes' : 'Create brand'}
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
          <Input label="Brand name" required value={d.name} error={errors.name} data-autofocus onChange={(e) => patch({ name: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })} />
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
        <ImageUploadField label="Logo" aspect="square" value={d.logoUrl} onChange={(url, file) => patch({ logoUrl: url, logoFile: file })} fallback={<BrandLogo name={d.name || '?'} size={72} />} hint="Square SVG or PNG on transparent background" />
        <Textarea label="Description" rows={3} value={d.description} onChange={(e) => patch({ description: e.target.value })} />
        <Input label="Website" optional icon={Globe} type="url" inputMode="url" placeholder="https://" value={d.website} error={errors.website} onChange={(e) => patch({ website: e.target.value })} />
        <div className="rounded-xl border border-zinc-200 p-4">
          <Toggle checked={d.status === 'active'} onChange={(on) => patch({ status: on ? 'active' : 'inactive' })} label="Active" description="Inactive brands are hidden from storefront filters. Their products stay available." />
        </div>
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
