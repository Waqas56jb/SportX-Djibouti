import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { ProductVariant } from '@/types';
import { Button } from '@/components/common';
import { ChipSelector, ColorSelector, NumberInput, Select } from '@/components/forms';
import { COLORS, SIZE_PRESETS, colorByName } from '@/constants/catalog';
import { uid } from '@/utils/id';
import { variantSku } from './model';

/** Bulk variant builder: colours × sizes, skipping combinations that already exist. */
export function VariantGenerator({
  productId,
  productSku,
  existing,
  defaultPreset,
  onGenerate,
}: {
  productId: string;
  productSku: string;
  existing: ProductVariant[];
  defaultPreset: string;
  onGenerate: (variants: ProductVariant[]) => void;
}) {
  const [colors, setColors] = useState<string[]>([]);
  const [presetId, setPresetId] = useState(defaultPreset);
  const [sizes, setSizes] = useState<string[]>([]);
  const [stock, setStock] = useState<number | ''>(10);
  const [threshold, setThreshold] = useState<number | ''>(3);

  const preset = SIZE_PRESETS.find((p) => p.id === presetId) ?? SIZE_PRESETS[0];
  const key = (c: string, s: string) => `${c}__${s}`.toLowerCase();
  const existingKeys = useMemo(() => new Set(existing.map((v) => key(v.color, v.size))), [existing]);
  const combos = colors.flatMap((c) => sizes.map((s) => ({ c, s })));
  const fresh = combos.filter(({ c, s }) => !existingKeys.has(key(c, s)));
  const skipped = combos.length - fresh.length;

  const generate = () => {
    const out: ProductVariant[] = fresh.map(({ c, s }) => ({
      id: uid('var'),
      productId,
      sku: variantSku(productSku, c, s),
      color: c,
      colorHex: colorByName(c)?.hex ?? '#888888',
      size: s,
      stock: stock === '' ? 0 : stock,
      reserved: 0,
      lowStockThreshold: threshold === '' ? 0 : threshold,
    }));
    onGenerate(out);
    setSizes([]);
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-950 text-volt">
          <Sparkles size={14} aria-hidden />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Variant generator</h3>
          <p className="text-xs text-zinc-500">Pick colours and sizes — every new combination becomes a variant.</p>
        </div>
      </div>
      <div className="space-y-4">
        <ColorSelector label="Colours" colors={COLORS} value={colors} onChange={setColors} multiple />
        <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
          <Select
            label="Size preset"
            value={presetId}
            options={SIZE_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
            onChange={(e) => {
              setPresetId(e.target.value);
              setSizes([]);
            }}
          />
          <div>
            <ChipSelector label="Sizes" options={preset.sizes} value={sizes} onChange={setSizes} />
            <button type="button" onClick={() => setSizes(sizes.length === preset.sizes.length ? [] : preset.sizes)} className="mt-2 text-xs font-medium text-zinc-600 hover:text-zinc-950">
              {sizes.length === preset.sizes.length ? 'Clear sizes' : 'Select all sizes'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <NumberInput label="Default stock" value={stock} min={0} onValueChange={setStock} className="w-36" />
          <NumberInput label="Low-stock threshold" value={threshold} min={0} onValueChange={setThreshold} className="w-40" />
          <div className="ml-auto flex flex-col items-end gap-1">
            <Button variant="primary" icon={Sparkles} disabled={fresh.length === 0} onClick={generate}>
              Generate {fresh.length || ''} variant{fresh.length === 1 ? '' : 's'}
            </Button>
            <span className="text-xs text-zinc-500" aria-live="polite">
              {combos.length === 0 ? 'Select at least one colour and size.' : skipped ? `${skipped} existing combination${skipped === 1 ? '' : 's'} skipped` : `SKU format ${variantSku(productSku, colors[0] ?? 'Black', sizes[0] ?? '42')}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
