import { CheckCircle2, Circle } from 'lucide-react';
import type { ProductStatus } from '@/types';
import { FormSection, RadioGroup, Toggle } from '@/components/forms';
import { cn } from '@/utils/cn';
import { TagInput } from './TagInput';
import { scrollToSection } from './SectionNav';
import type { ProductDraft, SectionId, SetDraft } from './model';

const STATUS_CARDS: { value: ProductStatus; label: string; description: string }[] = [
  { value: 'draft', label: 'Draft', description: 'Hidden from the storefront while you finish it.' },
  { value: 'published', label: 'Published', description: 'Visible and purchasable on the storefront.' },
  { value: 'archived', label: 'Archived', description: 'Retired. Kept for order history and reports.' },
];

const TAG_SUGGESTIONS = ['new-arrival', 'bestseller', 'limited', 'clearance', 'back-to-school', 'ramadan-edit'];

export function PublishingSection({ draft, set }: { draft: ProductDraft; set: SetDraft }) {
  const checks: { label: string; done: boolean; section: SectionId; required?: boolean }[] = [
    { label: 'Name, SKU, brand and category', done: Boolean(draft.name && draft.sku && draft.brandId && draft.categoryId), section: 'basic', required: true },
    { label: 'Sport, gender and product type', done: Boolean(draft.sport && draft.gender && draft.type), section: 'basic', required: true },
    { label: 'Price above 0', done: draft.price !== '' && draft.price > 0, section: 'pricing', required: true },
    { label: 'At least one variant', done: draft.variants.length > 0, section: 'variants', required: true },
    { label: 'Main image', done: draft.images.some((i) => i.role === 'main'), section: 'media', required: true },
    { label: 'Short description', done: Boolean(draft.shortDescription.trim()), section: 'description', required: true },
    { label: 'Stock available', done: draft.variants.some((v) => v.stock > 0), section: 'inventory' },
    { label: 'Hover image', done: draft.images.some((i) => i.role === 'hover'), section: 'media' },
    { label: 'Full description', done: Boolean(draft.description.trim()), section: 'description' },
    { label: 'Specifications', done: draft.specs.some((s) => s.label.trim() && s.value.trim()), section: 'specs' },
    { label: 'SEO title and description', done: Boolean(draft.seo.title.trim() && draft.seo.description.trim()), section: 'seo' },
  ];
  const missingRequired = checks.filter((c) => c.required && !c.done).length;
  const doneCount = checks.filter((c) => c.done).length;

  return (
    <FormSection id="publishing" title="Publishing" description="Visibility, merchandising and a readiness check before going live.">
      <RadioGroup label="Status" variant="cards" columns={3} value={draft.status} onChange={(v) => set('status', v)} options={STATUS_CARDS} />
      <div className="rounded-xl border border-zinc-200 p-4">
        <Toggle checked={draft.featured} onChange={(v) => set('featured', v)} label="Featured product" description="Pin to the homepage and top of category listings." />
      </div>
      <TagInput label="Tags" value={draft.tags} onChange={(t) => set('tags', t)} suggestions={TAG_SUGGESTIONS} help="Used for collections, filters and campaigns." />

      <div className="rounded-xl bg-zinc-50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">Readiness checklist</h3>
          <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', missingRequired ? 'bg-amber-100 text-amber-800' : 'bg-ink-950 text-volt')}>
            {missingRequired ? `${missingRequired} required to publish` : 'Ready to publish'} · {doneCount}/{checks.length}
          </span>
        </div>
        <ul className="grid gap-1 sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c.label}>
              <button type="button" onClick={() => scrollToSection(c.section)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.8125rem] hover:bg-white">
                {c.done ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-hidden /> : <Circle size={16} className={cn('shrink-0', c.required ? 'text-amber-500' : 'text-zinc-300')} aria-hidden />}
                <span className={cn(c.done ? 'text-zinc-500' : 'text-zinc-800')}>{c.label}</span>
                {c.required && !c.done && <span className="ml-auto text-2xs font-semibold uppercase tracking-wider text-amber-700">Required</span>}
                <span className="sr-only">{c.done ? 'done' : 'missing'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </FormSection>
  );
}
