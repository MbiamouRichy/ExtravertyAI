import { Skeleton } from "@/components/ui/skeleton";

export default function TeamLoading() {
  return (
    <div
      className="mx-auto w-full min-w-0 max-w-5xl px-4 py-6 sm:px-6"
      aria-busy="true"
    >
      <p role="status" className="sr-only">
        Chargement de l’équipe…
      </p>
      <div
        aria-hidden="true"
        className="space-y-8 motion-reduce:**:data-[slot=skeleton]:animate-none"
      >
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="w-full min-w-0 flex-1">
            <Skeleton className="h-9 w-60 max-w-full" />
            <Skeleton className="mt-2 h-4 w-full max-w-lg" />
            <Skeleton className="mt-2 h-4 w-3/4 max-w-sm" />
          </div>
          <Skeleton className="h-9 w-full shrink-0 sm:w-44" />
        </div>
        <div className="flex gap-3 rounded-lg border bg-muted/30 px-4 py-4">
          <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-4 w-72 max-w-full" />
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3 sm:hidden" />
            </div>
          </div>
        </div>
        <Skeleton className="h-9 w-full max-w-sm" />
        <div className="min-w-0 overflow-hidden rounded-2xl border bg-card">
          <div className="space-y-2 border-b bg-muted/20 px-4 py-5 sm:px-6">
            <Skeleton className="h-6 w-36 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
          <div className="divide-y">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="flex min-w-0 items-center gap-4 p-4 sm:px-6"
              >
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-32 max-w-full" />
                  <Skeleton className="h-3 w-48 max-w-full" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-2 shrink-0 rounded-full" />
                    <Skeleton className="h-2 w-40 max-w-full" />
                  </div>
                  <Skeleton className="h-5 w-24 rounded-full md:hidden" />
                </div>
                <Skeleton className="hidden h-6 w-24 rounded-full md:block" />
                <Skeleton className="size-8 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
