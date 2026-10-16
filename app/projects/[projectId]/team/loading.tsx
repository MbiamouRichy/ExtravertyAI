import { Skeleton } from "@/components/ui/skeleton";

export default function TeamLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Chargement de l’équipe"
      className="relative mx-auto w-full min-w-0 max-w-5xl p-4 sm:p-6 xl:p-8"
    >
      <p role="status" className="sr-only">
        Chargement de l’équipe…
      </p>
      <div aria-hidden="true" className="skeleton-shimmer space-y-8">
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-muted">
          <div className="loading-bar h-full w-1/3 rounded-full bg-foreground/50" />
        </div>

        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="w-full max-w-xl space-y-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-64 max-w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="h-9 w-full rounded-lg sm:w-44" />
        </header>

        {/* Rôles */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((role) => (
            <div key={role} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="size-8 rounded-lg" />
                <Skeleton className="h-7 w-8" />
              </div>
              <Skeleton className="mt-3 h-4 w-24" />
              <Skeleton className="mt-1.5 h-3 w-40 max-w-full" />
            </div>
          ))}
        </div>

        {/* Membres */}
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-9 w-full rounded-lg sm:w-64" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 5 }, (_, member) => (
              <div
                key={member}
                className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="min-w-0 space-y-1.5">
                    <Skeleton className="h-3.5 w-36 max-w-full" />
                    <Skeleton className="h-3 w-48 max-w-full" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
                  <Skeleton className="size-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
