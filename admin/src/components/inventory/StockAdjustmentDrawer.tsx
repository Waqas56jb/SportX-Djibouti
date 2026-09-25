import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, Minus, Plus, Equal } from 'lucide-react';
import type { InventoryItem, StockReason } from '@/types';
import { inventoryService } from '@/services/inventoryService';
import { useNotificationStore } from '@/store/notificationStore';
import { toast } from '@/store/toastStore';
import { STOCK_REASONS } from '@/constants/catalog';
import { STOCK_STATUS } from '@/constants/status';
import { variantStockStatus } from '@/utils/stock';
import { cn } from '@/utils/cn';
import { Button, ColorDot, ProductThumb, Segmented, StatusBadge } from '@/components/common';
import { NumberInput, Select, Textarea } from '@/components/forms';
import { Drawer } from '@/components/modals/Overlay';
import type { AdjustMode } from './inventoryMeta';

export interface StockAdjustmentDrawerProps {
  open: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onSaved?: (item: InventoryItem) => void;
  /** Optional preset for the action (e.g. "Add stock" row action). Defaults to Add. */
  initialMode?: AdjustMode;
}

const DEFAULT_REASON: Record<AdjustMode, StockReason> = { add: 'restock', remove: 'damaged', set: 'manual_correction' };
const MODE_OPTIONS: { value: AdjustMode; label: string }[] = [
  { value: 'add', label: 'Add' },
  { value: 'remove', label: 'Remove' },
  { value: 'set', label: 'Set exact quantity' },
];

function validate(mode: AdjustMode, qty: number | '', stock: number): string | undefined {
  if (qty === '') return 'Enter a quantity.';
  if (!Number.isFinite(qty) || !Number.isInteger(qty)) return 'Quantity must be a whole number.';
  if (qty < 0) return 'Quantity must be zero or more.';
  if (mode !== 'set' && qty === 0) return 'Quantity must be greater than 0.';
  if (mode === 'remove' && qty > stock) return `You can remove at most ${stock} unit${stock === 1 ? '' : 's'}.`;
  return undefined;
}

function nextStock(mode: AdjustMode, qty: number, stock: number) {
  if (mode === 'add') return stock + qty;
  if (mode === 'remove') return stock - qty;
  return qty;
}

/** Shared stock adjustment panel (used by Inventory, Products and Dashboard). */
export function StockAdjustmentDrawer({ open, item, onClose, onSaved, initialMode = 'add' }: StockAdjustmentDrawerProps) {
  const [mode, setMode] = useState<AdjustMode>(initialMode);
  const [qty, setQty] = useState<number | ''>('');
  const [reason, setReason] = useState<StockReason>(DEFAULT_REASON[initialMode]);
  const [reasonTouched, setReasonTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setQty(initialMode === 'set' && item ? item.stock : '');
    setReason(DEFAULT_REASON[initialMode]);
    setReasonTouched(false);
    setNotes('');
    setSubmitted(false);
    setServerError(null);
  }, [open, item?.variantId, initialMode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;

  const qtyError = validate(mode, qty, item.stock);
  const notesError = reason === 'other' && !notes.trim() ? 'Add a note explaining this adjustment.' : undefined;
  const showQtyError = (submitted || qty !== '') && qtyError;
  const valid = !qtyError && !notesError;
  const preview = !qtyError && qty !== '' ? nextStock(mode, qty, item.stock) : null;
  const delta = preview === null ? 0 : preview - item.stock;
  const previewStatus = preview === null ? null : variantStockStatus({ stock: preview, reserved: Math.min(item.reserved, preview), lowStockThreshold: item.threshold });

  const changeMode = (m: AdjustMode) => {
    setMode(m);
    setServerError(null);
    if (m === 'set') setQty(item.stock);
    else if (mode === 'set') setQty('');
    if (!reasonTouched) setReason(DEFAULT_REASON[m]);
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    if (!valid || qty === '') return;
    setSaving(true);
    setServerError(null);
    try {
      const { item: updated } = await inventoryService.adjustStock({ variantId: item.variantId, mode, quantity: qty, reason, notes: notes.trim() || undefined });
      toast.success('Stock updated.', { description: `${item.sku}: ${item.stock} → ${updated.stock}` });
      void useNotificationStore.getState().refreshCounts();
      onSaved?.(updated);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not update stock.';
      setServerError(msg);
      toast.error('Stock was not updated.', { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      dismissible={!saving}
      width="md"
      title="Adjust stock"
      description="Every change is recorded in the stock movement history."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="stock-adjust-form" loading={saving} disabled={submitted && !valid}>
            Save adjustment
          </Button>
        </>
      }
    >
      <form id="stock-adjust-form" onSubmit={submit} noValidate className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
          <ProductThumb src={item.productImage} alt={item.productName} size={52} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">{item.productName}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[0.8125rem] text-zinc-600">
              <ColorDot hex={item.colorHex} /> {item.color} / {item.size}
            </p>
            <p className="mt-0.5 font-mono text-xs text-zinc-500">{item.sku}</p>
          </div>
        </div>

        <dl className="grid grid-cols-3 divide-x divide-zinc-100 rounded-xl border border-zinc-200 text-center">
          {[
            { label: 'Current', value: item.stock },
            { label: 'Reserved', value: item.reserved },
            { label: 'Available', value: item.available },
          ].map((s) => (
            <div key={s.label} className="px-2 py-3">
              <dt className="text-xs font-medium text-zinc-500">{s.label}</dt>
              <dd className="mt-1 font-display text-2xl font-bold leading-none text-zinc-950 tabular">{s.value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <p className="mb-1.5 text-[0.8125rem] font-medium text-zinc-800">Action</p>
          <Segmented ariaLabel="Adjustment action" options={MODE_OPTIONS} value={mode} onChange={changeMode} className="w-full [&>button]:flex-1 [&>button]:py-1.5" />
        </div>

        <NumberInput
          label={mode === 'set' ? 'New stock quantity' : mode === 'add' ? 'Quantity to add' : 'Quantity to remove'}
          required
          min={0}
          max={mode === 'remove' ? item.stock : undefined}
          step={1}
          value={qty}
          onValueChange={(v) => {
            setQty(v);
            setServerError(null);
          }}
          error={showQtyError || undefined}
          help={mode === 'remove' ? `Up to ${item.stock} units can be removed.` : mode === 'set' ? 'Replaces the counted stock for this variant.' : undefined}
          data-autofocus
          suffix="units"
        />

        <Select
          label="Reason"
          required
          value={reason}
          onChange={(e) => {
            setReason(e.target.value as StockReason);
            setReasonTouched(true);
          }}
          options={STOCK_REASONS}
        />

        <Textarea
          label="Notes"
          required={reason === 'other'}
          optional={reason !== 'other'}
          rows={3}
          maxLength={300}
          showCount
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={reason === 'other' ? 'Explain why stock is changing…' : 'e.g. Supplier delivery #4821'}
          error={submitted ? notesError : undefined}
        />

        <div className={cn('rounded-xl border p-4', preview === null ? 'border-dashed border-zinc-200' : 'border-zinc-200 bg-zinc-50/60')} aria-live="polite">
          <p className="eyebrow">Preview</p>
          {preview === null ? (
            <p className="mt-2 text-[0.8125rem] text-zinc-500">Enter a valid quantity to preview the new stock level.</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="font-display text-3xl font-bold text-zinc-400 tabular">{item.stock}</span>
              <ArrowRight size={18} className="text-zinc-400" aria-hidden />
              <span className="font-display text-3xl font-bold text-zinc-950 tabular">{preview}</span>
              <span className={cn('inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular', delta > 0 ? 'bg-emerald-50 text-emerald-700' : delta < 0 ? 'bg-red-50 text-red-700' : 'bg-zinc-100 text-zinc-600')}>
                {delta > 0 ? <Plus size={11} aria-hidden /> : delta < 0 ? <Minus size={11} aria-hidden /> : <Equal size={11} aria-hidden />}
                {Math.abs(delta)}
              </span>
              {previewStatus && <StatusBadge map={STOCK_STATUS} value={previewStatus} />}
            </div>
          )}
          {preview !== null && preview < item.reserved && <p className="mt-2 text-xs text-amber-700">Reserved quantity will be reduced to {preview} — open orders may need attention.</p>}
        </div>

        {serverError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[0.8125rem] text-red-700">
            <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
            {serverError}
          </div>
        )}
      </form>
    </Drawer>
  );
}
