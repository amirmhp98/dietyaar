import { Skeleton } from '@/components/UiComponents';

/** Layout-stable placeholders for a meal's details. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-5 w-28" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="grid grid-cols-4 gap-2 rounded-xl border border-border bg-card p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
      <Skeleton className="h-11 w-full rounded-md" />
    </div>
  );
}
