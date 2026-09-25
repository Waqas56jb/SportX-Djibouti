import { Skeleton, SkeletonPanel } from '@/components/common';

export function OrderDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading order">
      <Skeleton className="mb-3 h-3 w-20" />
      <Skeleton className="mb-3 h-8 w-72" />
      <div className="mb-8 flex gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="panel p-5">
            <Skeleton className="mb-6 h-4 w-40" />
            <div className="grid grid-cols-7 gap-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="panel p-5">
            <Skeleton className="mb-5 h-4 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="mb-4 flex items-center gap-3">
                <Skeleton className="h-12 w-12" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-3.5 w-20" />
              </div>
            ))}
          </div>
          <SkeletonPanel rows={5} />
        </div>
        <div className="space-y-5">
          <SkeletonPanel rows={4} />
          <SkeletonPanel rows={5} />
          <SkeletonPanel rows={4} />
        </div>
      </div>
    </div>
  );
}
