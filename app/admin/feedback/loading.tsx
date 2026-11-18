import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de la page : en-tête, compteurs, filtres puis tableau.
export default function AdminFeedbackLoading() {
  return (
    <PageLoading label="Chargement des retours…">
      <div className="flex min-w-0 flex-col gap-6">
        <header className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-[32rem] max-w-full" />
        </header>

        {/* Compteurs : colonnes égales qui se partagent la largeur, libellés
            tronqués comme les vrais sur petit écran. */}
        <div className="grid gap-3 lg:grid-cols-2">
          {[4, 3].map((count) => (
            <div key={count} className="min-w-0 rounded-2xl border bg-card">
              <div className="px-4 pt-3">
                <Skeleton className="h-3 w-16" />
              </div>
              <div
                className={`grid divide-x ${count === 4 ? "grid-cols-4" : "grid-cols-3"}`}
              >
                {Array.from({ length: count }, (_, index) => (
                  <div key={index} className="min-w-0 space-y-2 px-3 pt-2 pb-3 sm:px-4">
                    <Skeleton className="h-3 w-14 max-w-full" />
                    <Skeleton className="h-7 w-8 max-w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Filtres : recherche sur toute la largeur jusqu'à lg. */}
        <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`min-w-0 space-y-2 ${index === 0 ? "sm:col-span-2 lg:col-span-1" : ""}`}
            >
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
            <Skeleton className="h-9 flex-1 lg:w-24 lg:flex-none" />
            <Skeleton className="h-9 w-10 shrink-0 sm:w-32" />
          </div>
        </div>

        {/* Tableau : auteur dès lg, statut dès md ; en dessous, ils passent
            sous le message. */}
        <div className="min-w-0">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_5rem] items-center gap-3 border-b px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)_8rem] sm:gap-4 md:grid-cols-[7rem_minmax(0,1fr)_7rem_8rem] lg:grid-cols-[7rem_minmax(0,1fr)_minmax(0,14rem)_7rem_8rem]">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-16 max-w-full" />
              <Skeleton className="hidden h-3 w-12 lg:block" />
              <Skeleton className="hidden h-3 w-12 md:block" />
              <Skeleton className="ml-auto h-3 w-10" />
            </div>
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)_5rem] items-start gap-3 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)_8rem] sm:gap-4 md:grid-cols-[7rem_minmax(0,1fr)_7rem_8rem] lg:grid-cols-[7rem_minmax(0,1fr)_minmax(0,14rem)_7rem_8rem]"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <Skeleton className="size-4 shrink-0 rounded-full" />
                  <Skeleton className="h-3.5 w-14 max-w-full" />
                </div>
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-4 w-full max-w-xl" />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 lg:hidden">
                    <Skeleton className="h-3 w-24 max-w-full" />
                    <Skeleton className="h-5 w-16 max-w-full shrink-0 rounded-full md:hidden" />
                  </div>
                </div>
                <div className="hidden min-w-0 space-y-1.5 lg:block">
                  <Skeleton className="h-3.5 w-28 max-w-full" />
                  <Skeleton className="h-3 w-36 max-w-full" />
                </div>
                <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
                <Skeleton className="ml-auto h-3 w-24 max-w-full" />
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col items-center justify-between gap-2 sm:flex-row">
            <Skeleton className="h-4 w-36" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
