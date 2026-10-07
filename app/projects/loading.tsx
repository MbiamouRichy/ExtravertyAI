import { Skeleton } from "@/components/ui/skeleton";
export default function ProjectsLoading() {
  return (
    <div
      role="status"
      aria-label="Chargement des projets"
      className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8"
    >
      <span className="sr-only">Chargement des projets…</span>
      <div
        aria-hidden="true"
        className="flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-start"
      >
        <div className="w-full min-w-0 space-y-3">
          <Skeleton className="h-8 w-40 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-2/3 max-w-sm" />
        </div>
        <Skeleton className="h-9 w-full shrink-0 sm:w-40" />
      </div>
      <div
        aria-hidden="true"
        className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:hidden"
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="min-w-0 space-y-4 rounded-xl border bg-card p-4"
          >
            <div className="flex justify-between gap-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="grid grid-cols-2 gap-2 border-t pt-3">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="hidden min-w-0 space-y-4 xl:block">
        <div className="flex justify-between gap-4">
          <Skeleton className="h-9 w-full max-w-sm" />
          <Skeleton className="h-9 w-28 shrink-0" />
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Skeleton className="h-12 w-full rounded-none" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-8 gap-4 border-t p-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                <Skeleton key={j} className="h-8 w-full" />
              ))}
            </div>
          ))}
        </div>
        <div className="flex justify-between gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    </div>
  );
}
