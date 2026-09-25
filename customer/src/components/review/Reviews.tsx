import { BadgeCheck, MessageSquare } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, ErrorState, InlineAlert, Modal, Rating, RatingInput, SelectField, SkeletonLoader, TextAreaField, TextField } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { errorMessage } from '@/services';
import { ApiError } from '@/services/api';
import { reviewService } from '@/services/reviewService';
import { toast } from '@/store/toastStore';
import type { Product, RatingSummary, Review, ReviewSort } from '@/types';
import { cn } from '@/utils/cn';
import { formatDate, formatNumber } from '@/utils/format';
import { t } from '@/i18n';

export function RatingBreakdown({ summary }: { summary: RatingSummary }) {
  return (
    <div>
      <div className="flex items-end gap-4">
        <p className="font-display text-7xl font-bold leading-none">{summary.average.toFixed(1)}</p>
        <div className="pb-1.5">
          <Rating value={summary.average} size="md" />
          <p className="mt-1.5 text-sm text-ink-500">{t('product.reviews.basedOn', { count: summary.total })}</p>
        </div>
      </div>
      <dl className="mt-6 space-y-2">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = summary.distribution[star];
          const pct = summary.total ? (count / summary.total) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-3 text-sm">
              <dt className="w-16 shrink-0 whitespace-nowrap text-ink-600">{t('product.reviews.star', { count: star })}</dt>
              <dd className="h-1.5 flex-1 overflow-hidden bg-paper-200">
                <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
              </dd>
              <dd className="w-10 shrink-0 text-end tabular-nums text-ink-500">{Math.round(pct)}%</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

const fitLabel = (fit: NonNullable<Review['fit']>) =>
  fit === 'small' ? t('product.reviews.fitSmall') : fit === 'large' ? t('product.reviews.fitLarge') : t('product.reviews.fitTrue');

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
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {t('product.reviews.verified')}
          </span>
        )}
        {review.size && <span>{t('product.reviews.sizeLabel', { size: review.size })}</span>}
        {review.fit && <span>{t('product.reviews.fitLabel', { fit: fitLabel(review.fit) })}</span>}
      </div>
    </article>
  );
}

function ReviewForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [fit, setFit] = useState<Review['fit']>('true');
  const [size, setSize] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const sized = product.sizes.length > 1;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!rating) next.rating = t('product.reviews.errRating');
    if (title.trim().length < 3) next.title = t('product.reviews.errTitle');
    if (body.trim().length < 20) next.body = t('product.reviews.errBody');
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      await reviewService.create({ productId: product.id, rating, title, body, fit: sized ? fit : undefined, size: sized && size ? size : undefined });
      toast.success(t('product.reviews.thanks'), { description: t('product.reviews.thanksBody') });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setFormError(t('product.reviews.notEligible'));
      } else if (err instanceof ApiError && err.status === 409) {
        setFormError(t('product.reviews.already'));
      } else {
        setFormError(errorMessage(err, t('product.reviews.sendFailed')));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5 px-5 py-6 sm:px-6">
      <p className="text-sm text-ink-500">{t('product.reviews.moderated')}</p>
      <RatingInput value={rating} onChange={setRating} error={errors.rating} />
      <TextField label={t('product.reviews.headline')} value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} maxLength={120} />
      <TextAreaField label={t('product.reviews.yourReview')} value={body} onChange={(e) => setBody(e.target.value)} error={errors.body} hint={t('product.reviews.hint')} maxLength={2000} />
      {sized && (
        <>
          <fieldset>
            <legend className="label">{t('product.reviews.fitQuestion')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {(['small', 'true', 'large'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFit(f)}
                  aria-pressed={fit === f}
                  className={cn('min-h-[44px] border px-1 text-sm leading-tight transition-colors', fit === f ? 'border-ink bg-ink text-white' : 'border-paper-300 hover:border-ink')}
                >
                  {fitLabel(f)}
                </button>
              ))}
            </div>
          </fieldset>
          <SelectField label={t('product.reviews.sizePurchased')} value={size} onChange={(e) => setSize(e.target.value)} optional placeholder={t('product.reviews.selectSize')} options={product.sizes.map((s) => ({ value: s, label: s }))} />
        </>
      )}
      {formError && <InlineAlert tone="warning">{formError}</InlineAlert>}
      <Button type="submit" variant="primary" fullWidth loading={loading}>
        {t('product.reviews.submit')}
      </Button>
    </form>
  );
}

const SORT_KEYS: ReviewSort[] = ['newest', 'highest', 'lowest', 'helpful'];
const sortLabel = (k: ReviewSort) =>
  ({ newest: t('product.reviews.sortNewest'), highest: t('product.reviews.sortHighest'), lowest: t('product.reviews.sortLowest'), helpful: t('product.reviews.sortHelpful') })[k];

export function ProductReviews({ product }: { product: Product }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [page, setPage] = useState(1);
  const [writing, setWriting] = useState(false);
  const [list, setList] = useState<Review[]>([]);
  const { data, loading, error, reload } = useAsync(() => reviewService.forProduct(product.id, { page, sort }), [product.id, page, sort], { keepPrevious: true });

  // Page 1 replaces the list; later pages append ("load more").
  useEffect(() => {
    if (!data) return;
    setList((prev) => (data.pagination.page === 1 ? data.reviews : [...prev, ...data.reviews.filter((r) => !prev.some((p) => p.id === r.id))]));
  }, [data]);

  useEffect(() => {
    setPage(1);
  }, [product.id, sort]);

  const summary: RatingSummary | undefined =
    data?.summary ?? (product.ratingDistribution ? { average: product.rating, total: product.reviewCount, distribution: product.ratingDistribution } : undefined);
  const total = data?.pagination.total ?? 0;
  const firstLoad = loading && list.length === 0;

  return (
    <section id="reviews" className="scroll-mt-24 border-t border-paper-200 py-16 sm:py-20" aria-labelledby="reviews-title">
      <div className="grid gap-12 lg:grid-cols-[360px_1fr] lg:gap-20">
        <div>
          <h2 id="reviews-title" className="heading-lg">
            {t('product.reviews.title')}
          </h2>
          {summary && summary.total > 0 && (
            <div className="mt-8">
              <RatingBreakdown summary={summary} />
            </div>
          )}
          <div className="mt-8">
            {isAuthenticated ? (
              <Button variant="outline" fullWidth onClick={() => setWriting(true)} leftIcon={<MessageSquare className="h-4 w-4" />}>
                {t('product.reviews.write')}
              </Button>
            ) : (
              <p className="text-sm text-ink-500">
                <Link to={`${ROUTES.login}?redirect=${encodeURIComponent(location.pathname + '#reviews')}`} className="font-semibold text-ink underline underline-offset-4">
                  {t('product.reviews.signIn')}
                </Link>{' '}
                {t('product.reviews.signInSuffix')}
              </p>
            )}
          </div>
        </div>

        <div>
          {error && list.length === 0 ? (
            <ErrorState message={error} onRetry={reload} />
          ) : firstLoad ? (
            <SkeletonLoader rows={3} />
          ) : list.length === 0 ? (
            <div className="py-10 text-ink-500">{t('product.reviews.none')}</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-paper-200 pb-4">
                <p className="text-sm text-ink-500">
                  {t('product.reviews.showing', { shown: list.length, total: formatNumber(total) })}
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-ink-500">{t('product.reviews.sort')}</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value as ReviewSort)} className="border-0 bg-transparent py-1 pe-6 text-sm font-medium focus:outline-none">
                    {SORT_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {sortLabel(k)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={cn('transition-opacity', loading && 'opacity-60')}>
                {list.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>
              {error && <p className="mt-4 text-sm text-danger">{error}</p>}
              {data?.pagination.hasNext && (
                <Button variant="outline" className="mt-8" loading={loading} onClick={() => setPage((p) => p + 1)}>
                  {t('product.reviews.loadMore')}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={writing} onClose={() => setWriting(false)} title={t('product.reviews.modalTitle', { name: product.name })}>
        <ReviewForm product={product} onDone={() => setWriting(false)} />
      </Modal>
    </section>
  );
}
