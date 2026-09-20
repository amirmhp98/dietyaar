import { Skeleton } from '@/components/UiComponents';

/** Layout-stable placeholders for the seven-day view and a day page. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-2 rounded-xl bg-muted p-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex min-h-14 items-center justify-between gap-3 px-3 py-2">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-7 w-9" />
          </div>
        ))}
      </div>
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  );
}
