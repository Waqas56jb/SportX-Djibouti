import { Package, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AccountSection } from '@/components/account/AccountLayout';
import { Badge, Button, ButtonLink, ConfirmDialog, EmptyState, ErrorState, Rating, SkeletonLoader, SmartImage, type BadgeTone } from '@/components/common';
import { ROUTES, productPath } from '@/constants/routes';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { friendlyError } from '@/services/authService';
import { reviewService } from '@/services/reviewService';
import { toast } from '@/store/toastStore';
import type { Review } from '@/types';
import { formatDate } from '@/utils/format';

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Awaiting moderation', tone: 'warning' },
  APPROVED: { label: 'Published', tone: 'success' },
  REJECTED: { label: 'Not published', tone: 'danger' },
  HIDDEN: { label: 'Hidden', tone: 'neutral' },
};

export default function AccountReviewsPage() {
  usePageMeta({ title: 'My Reviews', noindex: true });
  const { user } = useAuth();
  const { data, loading, error, reload, setData } = useAsync(() => reviewService.forUser(user!.id), [user?.id]);
  const [deleting, setDeleting] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await reviewService.remove(user!.id, deleting.id);
      setData((prev) => (prev ?? []).filter((r) => r.id !== deleting.id));
      toast.success('Review deleted');
      setDeleting(null);
    } catch (err) {
      toast.error('Could not delete review', { description: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  };

  const reviews = data ?? [];

  return (
    <AccountSection title="Reviews" description="Your product reviews help other athletes choose the right gear.">
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonLoader rows={3} />
      ) : reviews.length === 0 ? (
        <div className="border border-paper-200 bg-white">
          <EmptyState
            compact
            icon={<Star />}
            title="No reviews yet"
            description="Once you’ve tried your gear, share your thoughts from the product page."
            action={<ButtonLink to={ROUTES.accountOrders}>View orders</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => {
            const p = r.product;
            const href = p?.slug ? productPath(p.slug) : null;
            const status = r.status ? STATUS[r.status] : undefined;
            const thumb = (
              <div className="relative h-28 w-24 shrink-0 overflow-hidden bg-paper-100">
                {p?.image ? (
                  <SmartImage src={p.image} alt={p.name} sizes="96px" maxWidth={320} wrapperClassName="absolute inset-0" />
                ) : (
                  <Package className="absolute inset-0 m-auto h-6 w-6 text-ink-500" aria-hidden />
                )}
              </div>
            );
            return (
              <li key={r.id} className="flex flex-col gap-5 border border-paper-200 bg-white p-5 sm:flex-row sm:p-6">
                {href ? <Link to={href}>{thumb}</Link> : thumb}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    {p &&
                      (href ? (
                        <Link to={href} className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500 hover:text-ink">
                          {p.name}
                        </Link>
                      ) : (
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">{p.name}</span>
                      ))}
                    {status && <Badge tone={status.tone}>{status.label}</Badge>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Rating value={r.rating} />
                    <time className="text-xs text-ink-500" dateTime={r.createdAt}>
                      {formatDate(r.createdAt)}
                    </time>
                    {r.verified && <span className="text-xs font-medium text-success">Verified purchase</span>}
                  </div>
                  {r.title && <h3 className="mt-3 font-sans text-base font-semibold normal-case">{r.title}</h3>}
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{r.body}</p>
                </div>
                <Button variant="ghost" size="sm" className="self-start hover:text-danger" onClick={() => setDeleting(r)} leftIcon={<Trash2 className="h-3.5 w-3.5" />}>
                  Delete
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete review?"
        description="Your review will be removed from the product page. This can’t be undone."
        confirmLabel="Delete"
        destructive
        loading={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </AccountSection>
  );
}
