import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { FlashSale, FlashSaleInput } from '@/types';
import { Button } from '@/components/common';
import { DateInput, FormGrid, Input, NumberInput, Toggle } from '@/components/forms';
import { Drawer } from '@/components/modals/Overlay';
import { discountService } from '@/services/discountService';
import { toast } from '@/store/toastStore';
import { ProductPicker } from './ProductPicker';
import type { MarketingCatalog } from './useMarketingData';
import { errorMessage, formatDuration, fromLocalInput, toLocalDateTimeInput } from './utils';

interface FormState {
  name: string;
  start: string;
  end: string;
  productIds: string[];
  discountPercent: number | '';
  enabled: boolean;
}
type Errors = Partial<Record<keyof FormState, string>>;

const WEEK_MS = 7 * 24 * 3_600_000;

function toForm(f?: FlashSale): FormState {
  if (f) return { name: f.name, start: toLocalDateTimeInput(f.startsAt), end: toLocalDateTimeInput(f.endsAt), productIds: [...f.productIds], discountPercent: f.discountPercent, enabled: f.enabled };
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 3_600_000);
  return { name: '', start: toLocalDateTimeInput(start.toISOString()), end: toLocalDateTimeInput(end.toISOString()), productIds: [], discountPercent: 20, enabled: true };
}

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 3) e.name = 'Campaign name needs at least 3 characters.';
  if (!f.start) e.start = 'Start is required.';
  if (!f.end) e.end = 'End is required.';
  else if (f.start && fromLocalInput(f.end) <= fromLocalInput(f.start)) e.end = 'End must be after the start.';
  if (f.discountPercent === '' || f.discountPercent < 1 || f.discountPercent > 90) e.discountPercent = 'Use a discount between 1% and 90%.';
  else if (!Number.isInteger(f.discountPercent)) e.discountPercent = 'Use a whole percentage.';
  if (!f.productIds.length) e.productIds = 'Select at least one product.';
  return e;
}

export function FlashSaleFormDrawer({ open, sale, onClose, onSaved, catalog }: { open: boolean; sale?: FlashSale; onClose: () => void; onSaved: (s: FlashSale, created: boolean) => void; catalog: MarketingCatalog }) {
  const [form, setForm] = useState<FormState>(() => toForm());
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(sale));
    setErrors({});
  }, [open, sale]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const startMs = form.start ? new Date(form.start).getTime() : NaN;
  const endMs = form.end ? new Date(form.end).getTime() : NaN;
  const duration = endMs - startMs;
  const longWarning = Number.isFinite(duration) && duration > WEEK_MS;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    const input: FlashSaleInput = {
      name: form.name.trim(),
      startsAt: fromLocalInput(form.start),
      endsAt: fromLocalInput(form.end),
      productIds: form.productIds,
      discountPercent: form.discountPercent === '' ? 0 : form.discountPercent,
      enabled: form.enabled,
    };
    setSaving(true);
    try {
      const saved = sale ? await discountService.updateFlashSale(sale.id, input) : await discountService.createFlashSale(input);
      toast.success(sale ? 'Flash sale updated.' : 'Flash sale scheduled.', { description: saved.name });
      onSaved(saved, !sale);
    } catch (err) {
      toast.error('Couldn’t save flash sale.', { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      dismissible={!saving}
      width="xl"
      title={sale ? 'Edit flash sale' : 'Create flash sale'}
      description="Short, time-boxed markdowns on a hand-picked selection of products."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="flash-form" loading={saving}>
            {sale ? 'Save changes' : 'Create flash sale'}
          </Button>
        </>
      }
    >
      <form id="flash-form" onSubmit={submit} noValidate className="space-y-5">
        <Input label="Campaign name" required value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} maxLength={80} placeholder="e.g. Friday Night Boots Drop" data-autofocus />
        <FormGrid cols={3}>
          <DateInput withTime label="Start" required value={form.start} onChange={(e) => set('start', e.target.value)} error={errors.start} />
          <DateInput withTime label="End" required value={form.end} min={form.start || undefined} onChange={(e) => set('end', e.target.value)} error={errors.end} help={!errors.end && duration > 0 ? `Runs for ${formatDuration(duration)}` : undefined} />
          <NumberInput label="Discount" required value={form.discountPercent} onValueChange={(v) => set('discountPercent', v)} min={1} max={90} suffix="%" error={errors.discountPercent} help="Between 1% and 90%." />
        </FormGrid>
        {longWarning && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[0.8125rem] text-amber-900" role="status">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
            <span>
              This sale runs for {formatDuration(duration)}. Flash sales are usually short — 24 to 72 hours keeps the urgency. Consider an automatic discount for longer promotions.
            </span>
          </div>
        )}
        <ProductPicker products={catalog.products} loading={catalog.loading} value={form.productIds} onChange={(v) => set('productIds', v)} discountPercent={form.discountPercent === '' ? undefined : form.discountPercent} error={errors.productIds} />
        <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} label="Flash sale enabled" description="Disabled sales never go live, even inside their time window." />
      </form>
    </Drawer>
  );
}
