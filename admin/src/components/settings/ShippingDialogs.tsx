import { useEffect, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import type { ShippingMethod, ShippingMethodInput, ShippingZone } from '@/types';
import { Button } from '@/components/common/Button';
import { Modal, Drawer } from '@/components/modals/Overlay';
import { Field, FormGrid, controlClass } from '@/components/forms/Field';
import { CurrencyInput, Input, Select, Textarea } from '@/components/forms/Inputs';
import { Toggle } from '@/components/forms/Choice';
import { compact, required } from '@/utils/validation';
import { formatMoney } from '@/utils/format';
import type { FieldErrors } from './formErrors';

/** true = saved, false = failed (already toasted), object = server field errors to show inline. */
export type SubmitResult = boolean | FieldErrors;

// ─── Zone ───────────────────────────────────────────────────────────────────
export type ZoneInput = Pick<ShippingZone, 'name' | 'regions'>;

function RegionsInput({ value, onChange, error }: { value: string[]; onChange: (v: string[]) => void; error?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const parts = draft
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => !value.some((v) => v.toLowerCase() === p.toLowerCase()));
    if (parts.length) onChange([...value, ...parts]);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
  };
  return (
    <Field label="Regions" required error={error} help="Type a city or region and press Enter. Separate several with commas.">
      {({ id, describedBy, invalid }) => (
        <div className={controlClass(invalid, 'flex min-h-9 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900/10')}>
          {value.map((r) => (
            <span key={r} className="inline-flex items-center gap-1 rounded-md bg-zinc-100 py-0.5 pl-2 pr-1 text-xs font-medium text-zinc-800">
              {r}
              <button type="button" aria-label={`Remove ${r}`} onClick={() => onChange(value.filter((x) => x !== r))} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700">
                <X size={11} aria-hidden />
              </button>
            </span>
          ))}
          <input id={id} aria-describedby={describedBy} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={add} placeholder={value.length ? 'Add region…' : 'e.g. Balbala'} className="h-6 min-w-[8rem] flex-1 bg-transparent px-1 text-sm focus:outline-none" />
        </div>
      )}
    </Field>
  );
}

export function ZoneModal({ open, zone, onClose, onSubmit }: { open: boolean; zone?: ShippingZone; onClose: () => void; onSubmit: (input: ZoneInput) => Promise<SubmitResult> }) {
  const [name, setName] = useState('');
  const [regions, setRegions] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ name?: string; regions?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(zone?.name ?? '');
    setRegions(zone?.regions ?? []);
    setErrors({});
  }, [open, zone]);

  const submit = async () => {
    const errs = compact({ name: required(name, 'Zone name'), regions: regions.length ? undefined : 'Add at least one region.' });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const res = await onSubmit({ name: name.trim(), regions });
    setSaving(false);
    if (res === true) onClose();
    else if (res) setErrors({ name: res.name, regions: res.regions });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={zone ? 'Edit shipping zone' : 'Add shipping zone'}
      description="A zone groups the cities and regions that share the same delivery methods."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            {zone ? 'Save zone' : 'Create zone'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input label="Zone name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g. Djibouti City" data-autofocus maxLength={60} />
        <RegionsInput value={regions} onChange={setRegions} error={errors.regions} />
      </form>
    </Modal>
  );
}

// ─── Method ─────────────────────────────────────────────────────────────────
type MethodForm = Omit<ShippingMethodInput, 'price' | 'freeShippingThreshold'> & { price: number | ''; freeShippingThreshold: number | '' };

const emptyMethod = (zoneId: string): MethodForm => ({ zoneId, name: '', description: '', price: '', freeShippingThreshold: '', estimatedDelivery: '', enabled: true });

const fromMethod = (m: ShippingMethod): MethodForm => ({
  zoneId: m.zoneId,
  name: m.name,
  description: m.description,
  price: m.price,
  freeShippingThreshold: m.freeShippingThreshold ?? '',
  estimatedDelivery: m.estimatedDelivery,
  enabled: m.enabled,
});

export function MethodDrawer({ open, zones, zoneId, method, onClose, onSubmit }: { open: boolean; zones: ShippingZone[]; zoneId: string; method?: ShippingMethod; onClose: () => void; onSubmit: (input: ShippingMethodInput) => Promise<SubmitResult> }) {
  const [f, setF] = useState<MethodForm>(emptyMethod(zoneId));
  const [errors, setErrors] = useState<Partial<Record<keyof MethodForm, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(method ? fromMethod(method) : emptyMethod(zoneId));
    setErrors({});
  }, [open, method, zoneId]);

  const set = <K extends keyof MethodForm>(k: K, v: MethodForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    const errs = compact({
      zoneId: required(f.zoneId, 'Zone'),
      name: required(f.name, 'Method name'),
      price: f.price === '' ? 'Price is required (use 0 for free).' : f.price < 0 ? 'Price cannot be negative.' : undefined,
      freeShippingThreshold: f.freeShippingThreshold !== '' && f.freeShippingThreshold <= 0 ? 'Enter an amount above 0, or leave empty.' : undefined,
      estimatedDelivery: required(f.estimatedDelivery, 'Estimated delivery') ?? (/\d/.test(f.estimatedDelivery) ? undefined : 'Include the number of days, e.g. “2–4 days”.'),
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const res = await onSubmit({
      zoneId: f.zoneId,
      name: f.name.trim(),
      description: f.description.trim(),
      price: Number(f.price),
      freeShippingThreshold: f.freeShippingThreshold === '' ? undefined : Number(f.freeShippingThreshold),
      estimatedDelivery: f.estimatedDelivery.trim(),
      enabled: f.enabled,
    });
    setSaving(false);
    if (res === true) onClose();
    else if (res) setErrors({ ...res, estimatedDelivery: res.estimatedDelivery ?? res.minDays ?? res.maxDays } as typeof errors);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      dismissible={!saving}
      width="md"
      title={method ? 'Edit shipping method' : 'Add shipping method'}
      description="Shown to customers at checkout for addresses in this zone."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            {method ? 'Save method' : 'Create method'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Select label="Zone" required options={zones.map((z) => ({ value: z.id, label: z.name }))} value={f.zoneId} onChange={(e) => set('zoneId', e.target.value)} error={errors.zoneId} />
        <Input label="Method name" required value={f.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="e.g. Standard Delivery" data-autofocus maxLength={60} />
        <Textarea label="Description" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={160} showCount optional help="Short line shown under the method name at checkout." />
        <FormGrid>
          <CurrencyInput label="Price" required value={f.price} onValueChange={(v) => set('price', v)} error={errors.price} />
          <CurrencyInput label="Free shipping over" optional value={f.freeShippingThreshold} onValueChange={(v) => set('freeShippingThreshold', v)} error={errors.freeShippingThreshold} help={f.freeShippingThreshold ? `Free for orders of ${formatMoney(Number(f.freeShippingThreshold))} or more.` : 'Leave empty to always charge.'} />
        </FormGrid>
        <Input label="Estimated delivery" required value={f.estimatedDelivery} onChange={(e) => set('estimatedDelivery', e.target.value)} error={errors.estimatedDelivery} placeholder="e.g. 2–4 days" maxLength={40} help="Write a day range such as “1–2 days” or “3 days” — checkout shows it as a day range." />
        <div className="rounded-xl border border-zinc-200 px-4 py-3">
          <Toggle label="Available at checkout" description="Disabled methods stay configured but are hidden from customers." checked={f.enabled} onChange={(v) => set('enabled', v)} />
        </div>
      </form>
    </Drawer>
  );
}
