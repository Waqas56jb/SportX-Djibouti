import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PackageX } from 'lucide-react';
import { Button, EmptyState, ErrorState, Skeleton, SkeletonPanel } from '@/components/common';

export const isNotFound = (e: unknown) => typeof e === 'object' && e !== null && 'status' in e && (e as { status: unknown }).status === 404;

/** Not-found / load error block shared by product detail and edit screens. */
export function ProductLoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const navigate = useNavigate();
  if (!isNotFound(error)) return <ErrorState className="panel" onRetry={onRetry} description="We couldn’t load this product. Please try again." />;
  return (
    <div className="panel">
      <EmptyState
        icon={PackageX}
        title="Product not found"
        description="It may have been deleted, or the link is incorrect."
        action={
          <Button variant="primary" icon={ArrowLeft} onClick={() => navigate('/products')}>
            Back to products
          </Button>
        }
      />
    </div>
  );
}

export function ProductFormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading product">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="mb-8 h-7 w-72" />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="hidden space-y-2 lg:block">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
        <div className="space-y-6">
          <SkeletonPanel rows={6} />
          <SkeletonPanel rows={4} />
          <SkeletonPanel rows={5} />
        </div>
      </div>
    </div>
  );
}
