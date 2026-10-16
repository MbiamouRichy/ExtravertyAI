import { Skeleton } from "@/components/ui/skeleton";

export default function ContactsLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Chargement des contacts"
      className="relative mx-auto w-full max-w-7xl p-4 sm:p-6 xl:p-8"
    >
      <p role="status" className="sr-only">
        Chargement des contacts…
      </p>
      <div aria-hidden="true" className="skeleton-shimmer space-y-6">
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-muted">
          <div className="loading-bar h-full w-1/3 rounded-full bg-foreground/50" />
        </div>

        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="w-full max-w-xl space-y-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-9 w-72 max-w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="h-9 w-full rounded-lg sm:w-40" />
        </header>

        {/* Répartition */}
        <div className="grid grid-cols-3 divide-x rounded-2xl border bg-card">
          {[0, 1, 2].map((stat) => (
            <div key={stat} className="flex items-center gap-3 px-3 py-4 sm:px-6">
              <Skeleton className="hidden size-9 shrink-0 rounded-lg sm:block" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-12 sm:w-24" />
                <Skeleton className="h-6 w-10" />
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card">
          {/* Filtres et tri */}
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-8 w-14 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="ml-2 h-3 w-16" />
            </div>
            <Skeleton className="h-9 w-full rounded-lg sm:w-52" />
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-9 w-full rounded-lg sm:max-w-sm" />
              <Skeleton className="size-9 shrink-0 rounded-lg" />
            </div>

            {/* Mobile : cartes */}
            <div className="divide-y rounded-xl border md:hidden">
              {Array.from({ length: 4 }, (_, row) => (
                <div key={row} className="space-y-3 p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="size-9 rounded-full" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-28 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                </div>
              ))}
            </div>

            {/* Bureau : tableau */}
            <div className="hidden overflow-hidden rounded-xl border md:block">
              <div className="grid grid-cols-[2fr_1.4fr_1.2fr_1.1fr_1fr_6rem] gap-4 border-b bg-muted/30 px-4 py-3">
                {[20, 28, 24, 20, 18, 14].map((width, index) => (
                  <Skeleton
                    key={index}
                    className="h-3"
                    style={{ width: `${width * 4}px` }}
                  />
                ))}
              </div>
              {Array.from({ length: 8 }, (_, row) => (
                <div
                  key={row}
                  className="grid grid-cols-[2fr_1.4fr_1.2fr_1.1fr_1fr_6rem] items-center gap-4 border-b px-4 py-3 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-7 w-28 rounded-lg" />
                  <Skeleton className="h-5 w-24 rounded-sm" />
                  <Skeleton className="h-3 w-20" />
                  <div className="flex justify-end gap-1">
                    <Skeleton className="size-8 rounded-lg" />
                    <Skeleton className="size-8 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-28" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
