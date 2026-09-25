import { X } from 'lucide-react';
import { InlineAlert } from '@/components/common';
import { useT } from '@/i18n';
import { selectCartItems, useCartStore } from '@/store/cartStore';
import type { CartIssue } from '@/types';

/** "We updated your bag" — stock, availability and price changes reported by the server. */
export function CartIssuesAlert({ issues, onDismiss, className }: { issues: CartIssue[]; onDismiss?: () => void; className?: string }) {
  const { t, tDynamic, lang } = useT();
  const items = useCartStore(selectCartItems);
  const unique = issues.filter((i, idx) => issues.findIndex((x) => x.message === i.message) === idx);
  if (!unique.length) return null;

  // The API writes issue messages in English; other languages rebuild them from the issue code.
  const text = (i: CartIssue) => {
    if (lang === 'en' || !i.code) return i.message;
    const line = items.find((x) => x.id === i.itemId || x.variantId === i.variantId);
    const name = line ? `${line.name} (${line.color} / ${line.size})` : t('cart.issues.someItem');
    return tDynamic(`cart.issues.${i.code}`, i.message, { name, count: i.availableStock ?? '' });
  };

  return (
    <InlineAlert tone="warning" className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{t('cart.issues.title')}</p>
          <ul className="mt-1 list-inside list-disc">
            {unique.map((i) => (
              <li key={`${i.itemId}-${i.code ?? i.type}-${i.message}`}>{text(i)}</li>
            ))}
          </ul>
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="icon-btn -m-1 h-8 w-8 shrink-0" aria-label={t('cart.issues.dismiss')}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </InlineAlert>
  );
}
