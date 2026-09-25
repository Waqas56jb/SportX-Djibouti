import { useEffect, useState } from 'react';
import type { ProductVariant } from '@/types';
import { Drawer } from '@/components/modals/Overlay';
import { Button, ColorDot } from '@/components/common';
import { CurrencyInput, FormGrid, Input, NumberInput, Select } from '@/components/forms';
import { COLORS, colorByName } from '@/constants/catalog';
import { uid } from '@/utils/id';
import { variantSku } from './model';

type Draft = Omit<ProductVariant, 'price'> & { price: number | '' };

/** Add / edit a single variant. */
export function VariantDrawer({
  open,
  variant,
  productId,
  productSku,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  /** Undefined = create. */
  variant?: ProductVariant;
  productId: string;
  productSku: string;
  existing: ProductVariant[];
  onClose: () => void;
  onSave: (v: ProductVariant) => void;
}) {
  const [d, setD] = useState<Draft | null>(null);
  const [skuTouched, setSkuTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSkuTouched(Boolean(variant));
    setD(
      variant
        ? { ...variant, price: variant.price ?? '' }
        : { id: uid('var'), productId, sku: variantSku(productSku, 'Black', ''), color: 'Black', colorHex: colorByName('Black')!.hex, size: '', stock: 0, reserved: 0, lowStockThreshold: 3, price: '' },
    );
  }, [open, variant, productId, productSku]);

  if (!d) return null;
  const patch = (p: Partial<Draft>) =>
    setD((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...p };
      if (!skuTouched && ('color' in p || 'size' in p)) next.sku = variantSku(productSku, next.color, next.size);
      return next;
    });

  const save = () => {
    const e: Record<string, string> = {};
    if (!d.size.trim()) e.size = 'Size is required.';
    if (!d.sku.trim()) e.sku = 'SKU is required.';
    const others = existing.filter((v) => v.id !== d.id);
    if (others.some((v) => v.sku.toUpperCase() === d.sku.trim().toUpperCase())) e.sku = 'Another variant already uses this SKU.';
    if (others.some((v) => v.color === d.color && v.size.toLowerCase() === d.size.trim().toLowerCase())) e.size = `${d.color} / ${d.size} already exists.`;
    if (d.price !== '' && d.price <= 0) e.price = 'Must be greater than 0.';
    if (d.stock < 0) e.stock = 'Cannot be negative.';
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({ ...d, size: d.size.trim(), sku: d.sku.trim().toUpperCase(), price: d.price === '' ? undefined : d.price, barcode: d.barcode?.trim() || undefined });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="md"
      title={variant ? 'Edit variant' : 'Add variant'}
      description={variant ? `${variant.color} / ${variant.size}` : 'Create a single colour / size combination.'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {variant ? 'Save variant' : 'Add variant'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <Select
            label="Colour"
            required
            value={d.color}
            options={COLORS.map((c) => ({ value: c.name, label: c.name }))}
            onChange={(e) => patch({ color: e.target.value, colorHex: colorByName(e.target.value)?.hex ?? d.colorHex })}
            aside={<ColorDot hex={d.colorHex} size={14} />}
          />
          <Input label="Size" required value={d.size} error={errors.size} placeholder="e.g. 42 or M" onChange={(e) => patch({ size: e.target.value })} data-autofocus />
        </FormGrid>
        <Input
          label="SKU"
          required
          value={d.sku}
          error={errors.sku}
          inputClassName="font-mono uppercase text-[0.8125rem]"
          onChange={(e) => {
            setSkuTouched(true);
            patch({ sku: e.target.value.toUpperCase() });
          }}
          help={skuTouched ? undefined : 'Generated from the product SKU, colour and size.'}
        />
        <CurrencyInput label="Price override" optional value={d.price} error={errors.price} onValueChange={(v) => patch({ price: v })} help="Leave empty to use the product price." />
        <FormGrid>
          <NumberInput label="Stock" value={d.stock} min={0} error={errors.stock} onValueChange={(v) => patch({ stock: v === '' ? 0 : Math.round(v) })} />
          <NumberInput label="Low-stock threshold" value={d.lowStockThreshold} min={0} onValueChange={(v) => patch({ lowStockThreshold: v === '' ? 0 : Math.round(v) })} />
        </FormGrid>
        <Input label="Barcode" optional value={d.barcode ?? ''} inputClassName="font-mono text-[0.8125rem]" placeholder="EAN / UPC" onChange={(e) => patch({ barcode: e.target.value })} />
        {d.reserved > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{d.reserved} units are reserved by open orders.</p>}
      </div>
    </Drawer>
  );
}
