import { X } from 'lucide-react';
import { InlineAlert } from '@/components/common';
import type { CartIssue } from '@/types';

/** "We updated your bag" — stock, availability and price changes reported by the server. */
export function CartIssuesAlert({ issues, onDismiss, className }: { issues: CartIssue[]; onDismiss?: () => void; className?: string }) {
  const unique = issues.filter((i, idx) => issues.findIndex((x) => x.message === i.message) === idx);
  if (!unique.length) return null;
  return (
    <InlineAlert tone="warning" className={className}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">We updated your bag</p>
          <ul className="mt-1 list-inside list-disc">
            {unique.map((i) => (
              <li key={`${i.itemId}-${i.code ?? i.type}-${i.message}`}>{i.message}</li>
            ))}
          </ul>
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="icon-btn -m-1 h-8 w-8 shrink-0" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </InlineAlert>
  );
}
