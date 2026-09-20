import { Skeleton } from '@/components/UiComponents';

/** Layout-stable, neutral placeholders for the Today blocks; no zero totals. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-2 rounded-xl bg-muted p-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-36" />
        <div className="space-y-3 rounded-card bg-muted p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-1.5 w-full" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex min-h-16 items-center gap-3 px-3 py-3">
              <Skeleton className="size-5 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="size-11 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}
