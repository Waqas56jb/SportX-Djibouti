import { BadgeCheck, MessageSquare } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, ErrorState, Modal, Rating, RatingInput, SkeletonLoader, TextAreaField, TextField } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { errorMessage, reviewService } from '@/services';
import { toast } from '@/store/toastStore';
import type { Product, RatingSummary, Review } from '@/types';
import { cn } from '@/utils/cn';
import { formatDate, formatNumber } from '@/utils/format';

export function RatingBreakdown({ summary }: { summary: RatingSummary }) {
  return (
    <div>
      <div className="flex items-end gap-4">
        <p className="font-display text-7xl font-bold leading-none">{summary.average.toFixed(1)}</p>
        <div className="pb-1.5">
          <Rating value={summary.average} size="md" />
          <p className="mt-1.5 text-sm text-ink-500">Based on {formatNumber(summary.total)} reviews</p>
        </div>
      </div>
      <dl className="mt-6 space-y-2">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = summary.distribution[star];
          const pct = summary.total ? (count / summary.total) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-3 text-sm">
              <dt className="w-12 shrink-0 text-ink-600">{star} star</dt>
              <dd className="h-1.5 flex-1 overflow-hidden bg-paper-200">
                <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
              </dd>
              <dd className="w-10 shrink-0 text-right tabular-nums text-ink-500">{Math.round(pct)}%</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

const FIT_LABEL = { small: 'Runs small', true: 'True to size', large: 'Runs large' } as const;

export function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="border-b border-paper-200 py-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Rating value={review.rating} size="sm" />
        <time className="text-xs text-ink-500" dateTime={review.createdAt}>
          {formatDate(review.createdAt)}
        </time>
      </div>
      <h3 className="mt-3 font-sans text-base font-semibold normal-case">{review.title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{review.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
        <span className="font-semibold text-ink">{review.author}</span>
        {review.verified && (
          <span className="inline-flex items-center gap-1 text-success">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified purchase
          </span>
        )}
        {review.size && <span>Size: {review.size}</span>}
        {review.fit && <span>Fit: {FIT_LABEL[review.fit]}</span>}
      </div>
    </article>
  );
}

function ReviewForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [fit, setFit] = useState<Review['fit']>('true');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!rating) next.rating = 'Select a rating';
    if (title.trim().length < 3) next.title = 'Add a short headline';
    if (body.trim().length < 20) next.body = 'Tell us a little more (at least 20 characters)';
    setErrors(next);
    if (Object.keys(next).length || !user) return;
    setLoading(true);
    try {
      await reviewService.create(user, { productId: product.id, rating, title, body, fit: product.sizes.length > 1 ? fit : undefined });
      toast.success('Review published', { description: 'Thanks for sharing your experience.' });
      onDone();
    } catch (err) {
      toast.error('Could not publish review', { description: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5 px-5 py-6 sm:px-6">
      <RatingInput value={rating} onChange={setRating} error={errors.rating} />
      <TextField label="Headline" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} maxLength={80} />
      <TextAreaField label="Your review" value={body} onChange={(e) => setBody(e.target.value)} error={errors.body} hint="What did you like? How did it perform?" maxLength={1000} />
      {product.sizes.length > 1 && (
        <fieldset>
          <legend className="label">How does it fit?</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['small', 'true', 'large'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFit(f)}
                aria-pressed={fit === f}
                className={cn('min-h-[44px] border text-sm transition-colors', fit === f ? 'border-ink bg-ink text-white' : 'border-paper-300 hover:border-ink')}
              >
                {FIT_LABEL[f]}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <Button type="submit" variant="primary" fullWidth loading={loading}>
        Publish review
      </Button>
    </form>
  );
}

const PAGE = 4;

export function ProductReviews({ product }: { product: Product }) {
  const { data, loading, error, reload } = useAsync(() => reviewService.forProduct(product.id), [product.id]);
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [visible, setVisible] = useState(PAGE);
  const [sort, setSort] = useState<'recent' | 'highest' | 'lowest'>('recent');
  const [writing, setWriting] = useState(false);

  const sorted = useMemo(() => {
    const list = [...(data?.reviews ?? [])];
    if (sort === 'highest') list.sort((a, b) => b.rating - a.rating);
    if (sort === 'lowest') list.sort((a, b) => a.rating - b.rating);
    return list;
  }, [data, sort]);

  return (
    <section id="reviews" className="scroll-mt-24 border-t border-paper-200 py-16 sm:py-20" aria-labelledby="reviews-title">
      <div className="grid gap-12 lg:grid-cols-[360px_1fr] lg:gap-20">
        <div>
          <h2 id="reviews-title" className="heading-lg">
            Reviews
          </h2>
          {data && (
            <div className="mt-8">
              <RatingBreakdown summary={data.summary} />
            </div>
          )}
          <div className="mt-8">
            {isAuthenticated ? (
              <Button variant="outline" fullWidth onClick={() => setWriting(true)} leftIcon={<MessageSquare className="h-4 w-4" />}>
                Write a review
              </Button>
            ) : (
              <p className="text-sm text-ink-500">
                <Link to={`${ROUTES.login}?redirect=${encodeURIComponent(location.pathname + '#reviews')}`} className="font-semibold text-ink underline underline-offset-4">
                  Sign in
                </Link>{' '}
                to write a review.
              </p>
            )}
          </div>
        </div>

        <div>
          {error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : loading ? (
            <SkeletonLoader rows={3} />
          ) : sorted.length === 0 ? (
            <div className="py-10 text-ink-500">No reviews yet. Be the first to share your experience.</div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-paper-200 pb-4">
                <p className="text-sm text-ink-500">Showing {Math.min(visible, sorted.length)} of {sorted.length} recent reviews</p>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-ink-500">Sort</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="border-0 bg-transparent py-1 pr-6 text-sm font-medium focus:outline-none">
                    <option value="recent">Most recent</option>
                    <option value="highest">Highest rated</option>
                    <option value="lowest">Lowest rated</option>
                  </select>
                </label>
              </div>
              {sorted.slice(0, visible).map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
              {visible < sorted.length && (
                <Button variant="outline" className="mt-8" onClick={() => setVisible((v) => v + PAGE)}>
                  Load more reviews
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={writing} onClose={() => setWriting(false)} title={`Review: ${product.name}`}>
        <ReviewForm
          product={product}
          onDone={() => {
            setWriting(false);
            setSort('recent');
            reload();
          }}
        />
      </Modal>
    </section>
  );
}

