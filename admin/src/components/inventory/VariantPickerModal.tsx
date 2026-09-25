import { useEffect, useState } from 'react';
import { ChevronRight, SearchX } from 'lucide-react';
import type { InventoryItem } from '@/types';
import { STOCK_STATUS } from '@/constants/status';
import { ColorDot, EmptyState, ProductThumb, Skeleton, StatusBadge } from '@/components/common';
import { SearchInput } from '@/components/forms';
import { Modal } from '@/components/modals/Overlay';
import { inventoryService } from '@/services/inventoryService';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/misc';

const LIMIT = 40;

/** "Select a variant to adjust" — server-side search over the whole inventory. */
export function VariantPickerModal({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (item: InventoryItem) => void }) {
  const [q, setQ] = useState('');
  useEffect(() => {
    if (open) setQ('');
  }, [open]);
  const term = useDebounce(q.trim(), 250);
  const { data, loading } = useAsync(
    () => (open ? inventoryService.listInventory({ search: term || undefined, pageSize: LIMIT }) : Promise.resolve(undefined)),
    [open, term],
  );
  const items = data?.data;
  const results = items ?? [];
  const totalMatches = data?.pagination.total ?? 0;

  return (
    <Modal open={open} onClose={onClose} title="Select a variant to adjust" description="Search by product name, SKU, colour or size." size="lg">
      <SearchInput value={q} onChange={setQ} placeholder="Search variants…" label="Search variants" autoFocus />
      <div className="mt-3 max-h-[52vh] overflow-y-auto rounded-xl border border-zinc-200 scrollbar-thin">
        {loading && !items ? (
          <ul className="divide-y divide-zinc-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-10 w-10" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </li>
            ))}
          </ul>
        ) : results.length === 0 ? (
          <EmptyState compact icon={SearchX} title="No variants match" description="Try a different product name or SKU." />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {results.slice(0, LIMIT).map((i) => (
              <li key={i.variantId}>
                <button type="button" onClick={() => onSelect(i)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50">
                  <ProductThumb src={i.productImage} alt={i.productName} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-900">{i.productName}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                      <ColorDot hex={i.colorHex} size={10} /> {i.variantLabel} · <span className="font-mono">{i.sku}</span>
                    </span>
                  </span>
                  <span className="hidden text-right sm:block">
                    <span className="block text-sm font-semibold text-zinc-900 tabular">{i.stock}</span>
                    <span className="text-2xs text-zinc-500">in stock</span>
                  </span>
                  <StatusBadge map={STOCK_STATUS} value={i.status} />
                  <ChevronRight size={16} className="text-zinc-300" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {totalMatches > LIMIT && <p className="mt-2 text-xs text-zinc-500">Showing {LIMIT} of {totalMatches} variants — refine your search to narrow the list.</p>}
    </Modal>
  );
}
