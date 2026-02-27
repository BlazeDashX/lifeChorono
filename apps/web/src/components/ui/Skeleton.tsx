import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('shimmer rounded-lg', className)} />
  );
}

// Pre-built skeleton layouts

export function DashboardSkeleton() {
  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-surface p-4 rounded-xl border border-surface-border flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>

      {/* Today summary */}
      <div className="bg-surface p-6 rounded-xl border border-surface-border space-y-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-32" />
        <div className="space-y-2 pt-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      </div>

      {/* Donut */}
      <div className="bg-surface p-6 rounded-xl border border-surface-border flex justify-center">
        <Skeleton className="w-64 h-64 rounded-full" />
      </div>

      {/* Goal progress */}
      <div className="bg-surface p-6 rounded-xl border border-surface-border space-y-4">
        <Skeleton className="h-4 w-28" />
        {[1,2,3,4].map(i => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-surface p-6 rounded-xl border border-surface-border h-72">
        <Skeleton className="h-4 w-36 mb-4" />
        <Skeleton className="h-52 w-full" />
      </div>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 space-y-6 animate-fade-in">
      <div className="bg-surface p-6 rounded-xl border border-surface-border">
        <Skeleton className="h-7 w-28 mb-4" />
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-9 w-20" />)}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => (
          <div key={i} className="bg-surface p-4 rounded-xl border border-surface-border space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="bg-surface p-6 rounded-xl border border-surface-border space-y-3">
        <Skeleton className="h-5 w-40" />
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    </div>
  );
}

export function LogSkeleton() {
  return (
    <div className="max-w-2xl mx-auto pb-24 animate-fade-in">
      <div className="h-16 border-b border-surface-border flex items-center justify-between px-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="p-4 space-y-2">
        {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
      <div className="relative ml-16 mr-4 mt-4">
        {[1,2,3,4,5].map(i => (
          <Skeleton
            key={i}
            className="absolute w-full"
            style={{ top: `${i * 120}px`, height: `${60 + i * 10}px` }}
          />
        ))}
      </div>
    </div>
  );
}

export function InsightsSkeleton() {
  return (
    <div className="bg-surface p-6 rounded-xl border border-surface-border space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="space-y-2">
        {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    </div>
  );
}