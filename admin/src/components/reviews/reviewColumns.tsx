import { BadgeCheck, Check, Eye, EyeOff, Trash2, X } from 'lucide-react';
import type { Review, ReviewStatus } from '@/types';
import { Menu, ProductThumb, Rating, StatusBadge, type MenuItem } from '@/components/common';
import type { Column } from '@/components/tables';
import { PRODUCT_TYPES, labelOf } from '@/constants/catalog';
import { REVIEW_STATUS } from '@/constants/status';
import { formatDate, formatRelative } from '@/utils/format';

export const reviewColumns: Column<Review>[] = [
  {
    id: 'product',
    header: 'Product',
    hideable: false,
    mobile: 'subtitle',
    cell: (r) => (
      <span className="flex min-w-0 max-w-[15rem] items-center gap-3">
        <ProductThumb src={r.productImage} alt={r.productName} size={36} />
        <span className="min-w-0">
          <span className="block truncate font-medium text-zinc-900">{r.productName}</span>
          <span className="block truncate text-xs text-zinc-500">{labelOf(PRODUCT_TYPES, r.productType)}</span>
        </span>
      </span>
    ),
  },
  {
    id: 'customer',
    header: 'Customer',
    cell: (r) => (
      <span className="block whitespace-nowrap">
        <span className="block text-zinc-800">{r.customerName}</span>
        {r.verifiedPurchase && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <BadgeCheck size={12} aria-hidden /> Verified
          </span>
        )}
      </span>
    ),
  },
  { id: 'rating', header: 'Rating', mobile: 'aside', sortValue: (r) => r.rating, cell: (r) => <Rating value={r.rating} /> },
  {
    id: 'review',
    header: 'Review',
    hideable: false,
    mobile: 'title',
    cell: (r) => (
      <span className="block min-w-[16rem] max-w-md">
        <span className="block truncate font-medium text-zinc-900">{r.title}</span>
        <span className="mt-0.5 line-clamp-2 text-[0.8125rem] leading-snug text-zinc-500">{r.body}</span>
      </span>
    ),
  },
  {
    id: 'date',
    header: 'Date',
    sortValue: (r) => r.createdAt,
    cell: (r) => (
      <span className="whitespace-nowrap text-zinc-600" title={formatDate(r.createdAt)}>
        {formatRelative(r.createdAt)}
      </span>
    ),
  },
  { id: 'status', header: 'Status', mobile: 'meta', cell: (r) => <StatusBadge map={REVIEW_STATUS} value={r.status} /> },
];

export function ReviewRowMenu({ review: r, canModerate, canDelete, onOpen, onStatus, onDelete }: { review: Review; canModerate: boolean; canDelete: boolean; onOpen: () => void; onStatus: (s: ReviewStatus) => void; onDelete: () => void }) {
  const moderation: MenuItem[] = canModerate
    ? [
        { label: 'Approve', icon: Check, onSelect: () => onStatus('approved'), hidden: r.status === 'approved' },
        { label: 'Reject', icon: X, onSelect: () => onStatus('rejected'), hidden: r.status === 'rejected' },
        { label: 'Hide', icon: EyeOff, onSelect: () => onStatus('hidden'), hidden: r.status === 'hidden' },
      ]
        .filter((i) => !i.hidden)
        .map((i, idx) => ({ ...i, separator: idx === 0 }))
    : [];
  return (
    <Menu
      label={`Actions for review by ${r.customerName}`}
      items={[
        { label: 'View details', icon: Eye, onSelect: onOpen },
        ...moderation,
        { label: 'Delete', icon: Trash2, onSelect: onDelete, hidden: !canDelete, danger: true, separator: true },
      ]}
    />
  );
}
