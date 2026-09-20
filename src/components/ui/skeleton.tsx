import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

// Content-shaped placeholder for the club/personal pages while data loads —
// mirrors the real layout (header, hero card, cover grid) so there's no jarring
// swap from a spinner to a full page.
export function PageSkeleton() {
  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-3.5 w-1/3" />
        </div>
      </div>

      <Skeleton className="h-3 w-24" />
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="w-full aspect-[2/3] rounded-[3px]" />
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="p-5 flex gap-5">
          <Skeleton className="w-28 aspect-[2/3] rounded-[3px]" />
          <div className="flex-1 space-y-2.5 pt-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      </div>

      <Skeleton className="h-3 w-24" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="w-full aspect-[2/3] rounded-[3px]" />
        ))}
      </div>
    </div>
  );
}
