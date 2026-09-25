import { Link } from 'react-router-dom';
import { ArrowUpRight, BadgeCheck, Check, EyeOff, ThumbsUp, Trash2, X } from 'lucide-react';
import type { Review, ReviewStatus } from '@/types';
import { Avatar, Button, DescriptionList, Rating, StatusBadge } from '@/components/common';
import { Drawer } from '@/components/modals/Overlay';
import { PRODUCT_TYPES, labelOf } from '@/constants/catalog';
import { REVIEW_STATUS } from '@/constants/status';
import { formatDateTime, formatRelative } from '@/utils/format';

export interface ReviewDetailDrawerProps {
  review: Review | null;
  onClose: () => void;
  onStatus: (status: ReviewStatus) => void;
  onDelete: () => void;
  busy?: boolean;
  canModerate: boolean;
  canDelete: boolean;
}

/** Full review with moderation history and actions. */
export function ReviewDetailDrawer({ review: r, onClose, onStatus, onDelete, busy, canModerate, canDelete }: ReviewDetailDrawerProps) {
  return (
    <Drawer
      open={Boolean(r)}
      onClose={onClose}
      title="Review"
      description={r ? `Submitted ${formatRelative(r.createdAt)}` : undefined}
      width="md"
      headerExtra={r ? <div className="mt-3">{<StatusBadge map={REVIEW_STATUS} value={r.status} size="md" />}</div> : undefined}
      footer={
        r && (canModerate || canDelete) ? (
          <>
            {canDelete && (
              <Button variant="danger-ghost" icon={Trash2} onClick={onDelete} disabled={busy} className="mr-auto">
                Delete
              </Button>
            )}
            {canModerate && r.status !== 'hidden' && (
              <Button icon={EyeOff} onClick={() => onStatus('hidden')} disabled={busy}>
                Hide
              </Button>
            )}
            {canModerate && r.status !== 'rejected' && (
              <Button icon={X} onClick={() => onStatus('rejected')} disabled={busy}>
                Reject
              </Button>
            )}
            {canModerate && r.status !== 'approved' && (
              <Button variant="primary" icon={Check} onClick={() => onStatus('approved')} loading={busy}>
                Approve
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {r && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Avatar name={r.customerName} size={40} />
            <div className="min-w-0 flex-1">
              <Link to={`/customers/${r.customerId}`} className="block truncate text-sm font-semibold text-zinc-900 hover:underline">
                {r.customerName}
              </Link>
              {r.verifiedPurchase ? (
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <BadgeCheck size={13} aria-hidden /> Verified purchase
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-zinc-500">Unverified purchase</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
            <Rating value={r.rating} size={16} />
            <h3 className="mt-2.5 text-[0.9375rem] font-semibold text-zinc-950">{r.title}</h3>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-zinc-700">{r.body}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <ThumbsUp size={13} aria-hidden /> {r.helpfulCount} {r.helpfulCount === 1 ? 'person' : 'people'} found this helpful
            </p>
          </div>

          <DescriptionList
            columns={2}
            items={[
              {
                label: 'Product',
                value: (
                  <Link to={`/products/${r.productId}`} className="inline-flex items-center gap-1 font-medium text-zinc-900 hover:underline">
                    {r.productName} <ArrowUpRight size={13} aria-hidden />
                  </Link>
                ),
              },
              { label: 'Product type', value: labelOf(PRODUCT_TYPES, r.productType) },
              { label: 'Submitted', value: formatDateTime(r.createdAt) },
              { label: 'Status', value: <StatusBadge map={REVIEW_STATUS} value={r.status} /> },
              { label: 'Moderated by', value: r.moderatedBy ?? <span className="text-zinc-400">Not moderated yet</span> },
              { label: 'Moderated at', value: r.moderatedAt ? formatDateTime(r.moderatedAt) : <span className="text-zinc-400">—</span> },
            ]}
          />

          {r.status === 'pending' && canModerate && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[0.8125rem] text-amber-900">
              This review is waiting for moderation and isn’t visible on the storefront yet.
            </p>
          )}
        </div>
      )}
    </Drawer>
  );
}
