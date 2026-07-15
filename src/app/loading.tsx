import { Skeleton } from "@/components/ui/skeleton";

/**
 * Prefetched route shell for dynamic navigations. The root layout owns the
 * sidebar and top bar, so only the main content area is replaced while a page
 * is waiting on its server data.
 */
export default function PageLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 max-w-2/3" />
        <Skeleton className="h-4 w-[32rem] max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-4/5" />
      </div>
      <span className="sr-only">Loading the selected workspace page…</span>
    </div>
  );
}
