import { MessageSquarePlus, Star, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccountSection } from '@/components/account/AccountLayout';
import { Button, ButtonLink, ConfirmDialog, EmptyState, ErrorState, Rating, SkeletonLoader, SmartImage } from '@/components/common';
import { ROUTES, productPath } from '@/constants/routes';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { errorMessage, orderService, productService, reviewService } from '@/services';
import { toast } from '@/store/toastStore';
import type { Product, Review } from '@/types';
import { formatDate } from '@/utils/format';

export default function AccountReviewsPage() {
  usePageMeta({ title: 'My Reviews', noindex: true });
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    const [reviews, orders] = await Promise.all([reviewService.forUser(user!.id), orderService.listForUser(user!.id, user!.email)]);
    const deliveredIds = [...new Set(orders.filter((o) => o.status === 'delivered').flatMap((o) => o.items.map((i) => i.productId)))];
    const products = await productService.getByIds([...new Set([...reviews.map((r) => r.productId), ...deliveredIds])]);
    const pending = deliveredIds.filter((id) => !reviews.some((r) => r.productId === id));
    return { reviews, products, pending };
  }, [user?.id]);
  const [deleting, setDeleting] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map<string, Product>((data?.products ?? []).map((p) => [p.id, p])), [data]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await reviewService.remove(user!.id, deleting.id);
      toast.success('Review deleted');
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error('Could not delete review', { description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountSection title="Reviews" description="Your product reviews help other athletes choose the right gear.">
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonLoader rows={3} />
      ) : (
        <div className="space-y-10">
          {data.pending.length > 0 && (
            <section aria-labelledby="awaiting-title">
              <h2 id="awaiting-title" className="heading-sm mb-4">
                Awaiting your review
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.pending.map((id) => {
                  const p = byId.get(id);
                  if (!p) return null;
                  return (
                    <li key={id} className="flex items-center gap-4 border border-paper-200 bg-white p-4">
                      <div className="relative h-16 w-14 shrink-0 overflow-hidden bg-paper-100">
                        <SmartImage src={p.images[0].url} alt="" sizes="56px" maxWidth={320} wrapperClassName="absolute inset-0" />
                      </div>
                      <p className="min-w-0 flex-1 text-sm font-semibold">{p.name}</p>
                      <ButtonLink to={`${productPath(p.slug)}#reviews`} variant="outline" size="sm" leftIcon={<MessageSquarePlus className="h-4 w-4" />}>
                        Review
                      </ButtonLink>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="my-reviews-title">
            <h2 id="my-reviews-title" className="heading-sm mb-4">
              Your reviews
            </h2>
            {data.reviews.length === 0 ? (
              <div className="border border-paper-200 bg-white">
                <EmptyState compact icon={<Star />} title="No reviews yet" description="Once you’ve tried your gear, share your thoughts." action={<ButtonLink to={ROUTES.accountOrders}>View orders</ButtonLink>} />
              </div>
            ) : (
              <ul className="space-y-4">
                {data.reviews.map((r) => {
                  const p = byId.get(r.productId);
                  return (
                    <li key={r.id} className="flex flex-col gap-5 border border-paper-200 bg-white p-5 sm:flex-row sm:p-6">
                      {p && (
                        <Link to={productPath(p.slug)} className="relative h-28 w-24 shrink-0 overflow-hidden bg-paper-100">
                          <SmartImage src={p.images[0].url} alt={p.name} sizes="96px" maxWidth={320} wrapperClassName="absolute inset-0" />
                        </Link>
                      )}
                      <div className="min-w-0 flex-1">
                        {p && (
                          <Link to={productPath(p.slug)} className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500 hover:text-ink">
                            {p.name}
                          </Link>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <Rating value={r.rating} />
                          <time className="text-xs text-ink-500" dateTime={r.createdAt}>
                            {formatDate(r.createdAt)}
                          </time>
                        </div>
                        <h3 className="mt-3 font-sans text-base font-semibold normal-case">{r.title}</h3>
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
          </section>
        </div>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete review?"
        description="Your review will be removed from the product page."
        confirmLabel="Delete"
        destructive
        loading={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </AccountSection>
  );
}
