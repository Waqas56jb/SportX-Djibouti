import { ArrowDown, ArrowUp, ListPlus, Plus, Trash2, Wand2 } from 'lucide-react';
import { Button, IconButton } from '@/components/common';
import { FormSection, Input, Textarea } from '@/components/forms';
import { uid } from '@/utils/id';
import { SearchPreview } from '../SearchPreview';
import { TagInput } from './TagInput';
import type { FormErrors, ProductDraft, SetDraft, SpecRow } from './model';

// ─── Description ────────────────────────────────────────────────────────────
export function DescriptionSection({ draft, set, errors }: { draft: ProductDraft; set: SetDraft; errors: FormErrors }) {
  return (
    <FormSection id="description" title="Description" description="Short copy appears on product cards; the full description on the product page.">
      <Textarea
        label="Short description"
        rows={2}
        maxLength={160}
        showCount
        value={draft.shortDescription}
        error={errors.shortDescription}
        placeholder="One or two sentences on what makes this product stand out."
        onChange={(e) => set('shortDescription', e.target.value)}
      />
      <Textarea
        label="Full description"
        rows={8}
        value={draft.description}
        error={errors.description}
        placeholder="Materials, fit, technology, care instructions…"
        help="Plain text. Line breaks are preserved on the storefront."
        aside={<span className="tabular">{draft.description.trim() ? draft.description.trim().split(/\s+/).length : 0} words</span>}
        onChange={(e) => set('description', e.target.value)}
      />
    </FormSection>
  );
}

// ─── Specifications ─────────────────────────────────────────────────────────
const SPEC_SUGGESTIONS = ['Upper', 'Outsole', 'Closure', 'Material', 'Fit', 'Weight', 'Surface', 'Care'];

export function SpecsSection({ specs, onChange, error }: { specs: SpecRow[]; onChange: (s: SpecRow[]) => void; error?: string }) {
  const patch = (id: string, p: Partial<SpecRow>) => onChange(specs.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...specs];
    const [row] = next.splice(i, 1);
    next.splice(i + dir, 0, row);
    onChange(next);
  };
  const unused = SPEC_SUGGESTIONS.filter((s) => !specs.some((x) => x.label.toLowerCase() === s.toLowerCase()));
  return (
    <FormSection
      id="specs"
      title="Specifications"
      description="Technical details shown as a table on the product page."
      actions={
        <Button size="sm" icon={Plus} onClick={() => onChange([...specs, { id: uid('spec'), label: '', value: '' }])}>
          Add row
        </Button>
      }
    >
      {specs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center">
          <ListPlus size={20} className="text-zinc-400" aria-hidden />
          <p className="text-[0.8125rem] text-zinc-500">No specifications yet.</p>
        </div>
      ) : (
        <ol className="space-y-2" aria-label="Specifications">
          {specs.map((s, i) => (
            <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl border border-zinc-200 p-2 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-center sm:border-0 sm:p-0">
              <Input aria-label={`Specification ${i + 1} name`} placeholder="Name, e.g. Upper" value={s.label} onChange={(e) => patch(s.id, { label: e.target.value })} className="col-span-2 sm:col-span-1" />
              <Input aria-label={`Specification ${i + 1} value`} placeholder="Value, e.g. Knit textile" value={s.value} onChange={(e) => patch(s.id, { value: e.target.value })} />
              <div className="flex items-center">
                <IconButton icon={ArrowUp} size="sm" label={`Move ${s.label || 'row'} up`} disabled={i === 0} onClick={() => move(i, -1)} />
                <IconButton icon={ArrowDown} size="sm" label={`Move ${s.label || 'row'} down`} disabled={i === specs.length - 1} onClick={() => move(i, 1)} />
                <IconButton icon={Trash2} size="sm" label={`Remove ${s.label || 'row'}`} className="hover:!bg-red-50 hover:!text-red-600" onClick={() => onChange(specs.filter((x) => x.id !== s.id))} />
              </div>
            </li>
          ))}
        </ol>
      )}
      {error && (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
      {unused.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500">Quick add:</span>
          {unused.map((label) => (
            <button key={label} type="button" onClick={() => onChange([...specs, { id: uid('spec'), label, value: '' }])} className="rounded-md border border-dashed border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900">
              + {label}
            </button>
          ))}
        </div>
      )}
    </FormSection>
  );
}

// ─── SEO ────────────────────────────────────────────────────────────────────
export function SeoSection({ draft, set, brandName }: { draft: ProductDraft; set: SetDraft; brandName?: string }) {
  const seo = draft.seo;
  const patch = (p: Partial<ProductDraft['seo']>) => set('seo', { ...seo, ...p });
  const fill = () =>
    patch({
      title: seo.title || `${draft.name}${brandName && !draft.name.toLowerCase().includes(brandName.toLowerCase()) ? ` — ${brandName}` : ''} | SPORTX`.slice(0, 60),
      description: seo.description || draft.shortDescription.slice(0, 160),
    });
  const suggestions = [brandName?.toLowerCase(), draft.sport, draft.type, 'djibouti'].filter((x): x is string => Boolean(x));
  return (
    <FormSection
      id="seo"
      title="SEO"
      description="Control how this product appears in search engines."
      actions={
        <Button size="sm" variant="ghost" icon={Wand2} onClick={fill} disabled={!draft.name}>
          Fill from product
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <Input label="Meta title" value={seo.title} maxLength={60} placeholder={draft.name || 'Product title'} aside={<span className="tabular">{seo.title.length}/60</span>} onChange={(e) => patch({ title: e.target.value })} />
          <Textarea label="Meta description" rows={3} maxLength={160} showCount value={seo.description} placeholder={draft.shortDescription || 'Describe the product in one sentence.'} onChange={(e) => patch({ description: e.target.value })} />
          <TagInput label="Keywords" value={seo.keywords} onChange={(k) => patch({ keywords: k })} max={12} suggestions={suggestions} />
        </div>
        <div>
          <div className="mb-1.5 text-[0.8125rem] font-medium text-zinc-800">Search preview</div>
          <SearchPreview title={seo.title || draft.name} description={seo.description || draft.shortDescription} slug={draft.slug} />
        </div>
      </div>
    </FormSection>
  );
}
