import { Skeleton } from '@/components/UiComponents';

/** Layout-stable placeholders for the three Today blocks; no zero totals. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex min-h-14 items-center justify-between gap-3 px-3 py-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}
