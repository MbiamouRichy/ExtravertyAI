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
            <div key={stat} className="flex min-w-0 items-center gap-3 px-3 py-4 sm:px-6">
              <Skeleton className="hidden size-9 shrink-0 rounded-lg sm:block" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-3 w-12 max-w-full sm:w-24" />
                <Skeleton className="h-6 w-10" />
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card">
          {/* Filtres et tri : les filtres passent à la ligne comme les vrais. */}
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap items-center gap-1">
              <Skeleton className="h-8 w-12 shrink-0 rounded-full" />
              <Skeleton className="h-8 w-26 shrink-0 rounded-full" />
              <Skeleton className="h-8 w-18 shrink-0 rounded-full" />
              <Skeleton className="ml-2 h-3 w-16 shrink-0" />
            </div>
            <Skeleton className="h-9 w-full shrink-0 sm:w-52" />
          </div>

          <div className="min-w-0 space-y-4 p-4 sm:p-5">
            {/* Recherche et colonnes : icône seule sur mobile. */}
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-10 min-w-0 flex-1 sm:max-w-sm" />
              <Skeleton className="h-10 w-10 shrink-0 sm:w-28" />
            </div>

            {/* Mobile : liste */}
            <ul className="-mx-4 divide-y overflow-hidden border-y md:hidden sm:-mx-5">
              {Array.from({ length: 6 }, (_, row) => (
                <li key={row} className="flex min-w-0 gap-3 px-4 py-3 sm:px-5">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                        <Skeleton className="h-4 w-36 max-w-full" />
                        <Skeleton className="h-3 w-28 max-w-full" />
                      </div>
                      <Skeleton className="-mr-2 -mt-1.5 size-9 shrink-0 rounded-full" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <Skeleton className="h-4 w-20 shrink-0 rounded-sm" />
                      <Skeleton className="h-3.5 w-24 shrink-0" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Tablette : identité, prise en charge et actions ; grand écran :
                toutes les colonnes, comme le vrai tableau. */}
            <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
              <div className="grid grid-cols-[minmax(0,1fr)_8rem_8.25rem] items-center gap-4 border-b bg-muted/40 px-4 py-3.5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_8rem_minmax(0,0.9fr)_minmax(0,0.9fr)_8.25rem]">
                <Skeleton className="h-3 w-16 max-w-full" />
                <Skeleton className="hidden h-3 w-28 max-w-full xl:block" />
                <Skeleton className="h-3 w-24 max-w-full" />
                <Skeleton className="hidden h-3 w-20 max-w-full xl:block" />
                <Skeleton className="hidden h-3 w-16 max-w-full xl:block" />
                <Skeleton className="ml-auto h-3 w-14 max-w-full" />
              </div>
              {Array.from({ length: 8 }, (_, row) => (
                <div
                  key={row}
                  className="grid grid-cols-[minmax(0,1fr)_8rem_8.25rem] items-center gap-4 border-b px-4 py-3 last:border-b-0 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_8rem_minmax(0,0.9fr)_minmax(0,0.9fr)_8.25rem]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-36 max-w-full" />
                      <Skeleton className="h-3 w-28 max-w-full xl:hidden" />
                    </div>
                  </div>
                  <Skeleton className="hidden h-3.5 w-32 max-w-full xl:block" />
                  <Skeleton className="h-8 w-32 max-w-full rounded-full" />
                  <Skeleton className="hidden h-4 w-20 max-w-full rounded-sm xl:block" />
                  <Skeleton className="hidden h-3 w-20 max-w-full xl:block" />
                  <div className="flex justify-end gap-1">
                    <Skeleton className="size-10 shrink-0 rounded-md" />
                    <Skeleton className="size-10 shrink-0 rounded-md" />
                    <Skeleton className="size-10 shrink-0 rounded-md" />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination : le total au-dessus des flèches sur mobile. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton className="h-4 w-24" />
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <Skeleton className="mr-auto h-4 w-24 sm:mr-0" />
                <Skeleton className="size-9 shrink-0" />
                <Skeleton className="size-9 shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
