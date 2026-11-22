import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de la page : en-tête, indicateurs, tableau par article, filtres puis avis.
export default function AdminHelpFeedbackLoading() {
  return (
    <PageLoading label="Chargement des avis sur l’aide…">
      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-9 w-64 max-w-full" />
            <Skeleton className="h-4 w-[32rem] max-w-full" />
          </div>
          <Skeleton className="h-9 w-48 max-w-full" />
        </header>

        {/* Indicateurs : deux colonnes, puis quatre dès sm. */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="min-w-0 space-y-2 bg-card px-4 py-3">
              <Skeleton className="h-3 w-20 max-w-full" />
              <Skeleton className="h-7 w-12 max-w-full" />
              <Skeleton className="h-3 w-24 max-w-full" />
            </div>
          ))}
        </div>

        {/* Par article : Utile et Pas utile apparaissent dès sm. */}
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-5 w-28" />
          <div className="overflow-hidden rounded-2xl border bg-card">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="grid grid-cols-[minmax(0,1fr)_8rem_4rem] items-center gap-4 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_12rem_4rem_5rem_6rem]"
              >
                <Skeleton className="h-4 w-full max-w-sm" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="hidden h-3 w-8 justify-self-end sm:block" />
                <Skeleton className="hidden h-3 w-8 justify-self-end sm:block" />
                <Skeleton className="h-5 w-8 justify-self-end rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Statuts, filtres puis liste des avis. */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-8 w-28 rounded-full" />
            ))}
          </div>
          <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="min-w-0 space-y-2">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
            <Skeleton className="h-9 w-full lg:w-28" />
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="grid grid-cols-[5rem_minmax(0,1fr)_5rem] items-start gap-3 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[6rem_minmax(0,1fr)_6rem_7rem] sm:gap-4"
              >
                <Skeleton className="h-3.5 w-16 max-w-full" />
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-4 w-full max-w-md" />
                  <Skeleton className="h-3 w-full max-w-xl" />
                </div>
                <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
                <Skeleton className="ml-auto h-3 w-20 max-w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
