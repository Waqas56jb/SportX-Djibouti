import { useState } from 'react';
import { Layers, Plus } from 'lucide-react';
import type { ProductVariant } from '@/types';
import { Button, EmptyState } from '@/components/common';
import { FormSection } from '@/components/forms';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { formatNumber } from '@/utils/format';
import { uid } from '@/utils/id';
import type { FormErrors, ProductDraft } from './model';
import { VariantGenerator } from './VariantGenerator';
import { VariantTable } from './VariantTable';
import { VariantDrawer } from './VariantDrawer';

function presetFor(d: ProductDraft): string {
  switch (d.type) {
    case 'footwear':
      return d.gender === 'women' ? 'eu-women' : d.gender === 'kids' ? 'eu-kids' : 'eu-men';
    case 'apparel':
    case 'jersey':
    case 'shorts':
    case 'tracksuit':
      return d.gender === 'kids' ? 'kids-apparel' : 'apparel';
    case 'socks':
      return 'socks';
    case 'gloves':
      return 'gloves';
    case 'ball':
      return d.sport === 'basketball' ? 'ball-basketball' : 'ball-football';
    case 'bag':
    case 'equipment':
      return 'one-size';
    default:
      return 'apparel';
  }
}

export function VariantsSection({
  draft,
  productId,
  errors,
  update,
}: {
  draft: ProductDraft;
  productId: string;
  errors: FormErrors;
  update: (fn: (prev: ProductVariant[]) => ProductVariant[]) => void;
}) {
  const [drawer, setDrawer] = useState<{ open: boolean; variant?: ProductVariant }>({ open: false });
  const variants = draft.variants;
  const total = variants.reduce((s, v) => s + v.stock, 0);
  const colours = new Set(variants.map((v) => v.color)).size;

  const patch = (id: string, p: Partial<ProductVariant>) => update((list) => list.map((v) => (v.id === id ? { ...v, ...p } : v)));

  const duplicate = (v: ProductVariant) => {
    const copy: ProductVariant = { ...v, id: uid('var'), sku: `${v.sku}-2`, stock: 0, reserved: 0 };
    update((list) => {
      const i = list.findIndex((x) => x.id === v.id);
      const next = [...list];
      next.splice(i + 1, 0, copy);
      return next;
    });
    setDrawer({ open: true, variant: copy });
    toast.info('Variant duplicated.', { description: 'Change the size or colour to make it unique.' });
  };

  const remove = async (v: ProductVariant) => {
    const ok = await confirm({
      title: 'Delete variant?',
      description: v.reserved > 0 ? `${v.color} / ${v.size} has ${v.reserved} units reserved by open orders. Deleting it may affect fulfilment.` : `${v.color} / ${v.size} will be removed when you save the product.`,
      confirmLabel: 'Delete Variant',
      tone: 'danger',
    });
    if (ok) update((list) => list.filter((x) => x.id !== v.id));
  };

  return (
    <FormSection
      id="variants"
      title="Variants"
      description="Every sellable colour and size combination, each with its own SKU and stock."
      actions={
        <Button size="sm" icon={Plus} onClick={() => setDrawer({ open: true })}>
          Add variant
        </Button>
      }
    >
      <VariantGenerator
        productId={productId}
        productSku={draft.sku}
        existing={variants}
        defaultPreset={presetFor(draft)}
        onGenerate={(vs) => {
          update((list) => [...list, ...vs]);
          toast.success(`${vs.length} variant${vs.length === 1 ? '' : 's'} generated.`);
        }}
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-live="polite">
        <Total label="Variants" value={variants.length} />
        <Total label="Colours" value={colours} />
        <Total label="Total stock" value={total} />
        {errors.variants && (
          <p className="ml-auto text-xs font-medium text-red-600" role="alert">
            {errors.variants}
          </p>
        )}
      </div>

      {variants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300">
          <EmptyState
            compact
            icon={Layers}
            title="No variants yet"
            description="Use the generator above or add a single variant."
            action={
              <Button size="sm" icon={Plus} onClick={() => setDrawer({ open: true })}>
                Add variant
              </Button>
            }
          />
        </div>
      ) : (
        <VariantTable variants={variants} errors={errors} onPatch={patch} onEdit={(v) => setDrawer({ open: true, variant: v })} onDuplicate={duplicate} onRemove={(v) => void remove(v)} />
      )}

      <VariantDrawer
        open={drawer.open}
        variant={drawer.variant}
        productId={productId}
        productSku={draft.sku}
        existing={variants}
        onClose={() => setDrawer({ open: false })}
        onSave={(v) => {
          update((list) => (list.some((x) => x.id === v.id) ? list.map((x) => (x.id === v.id ? v : x)) : [...list, v]));
          setDrawer({ open: false });
        }}
      />
    </FormSection>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-display text-2xl font-bold tabular text-zinc-950">{formatNumber(value)}</span>
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
    </div>
  );
}
