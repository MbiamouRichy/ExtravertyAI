import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir du pipeline : en-tête, quatre chiffres alignés en tête de case,
// devise, puis les cinq colonnes (une à l’écran sur mobile, la suivante qui
// dépasse ; cinq côte à côte sur très grand écran).
export default function PipelineLoading() {
  return (
    <PageLoading
      label="Chargement du pipeline…"
      className="mx-auto w-full max-w-400 p-4 sm:p-6 xl:p-8"
    >
      <div className="space-y-6">
        <header className="space-y-2.5">
          <Skeleton className="h-3 w-48 max-w-full" />
          <Skeleton className="h-8 w-72 max-w-full md:h-9" />
          <div className="max-w-2xl space-y-2 pt-0.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        </header>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-2 bg-card p-4">
              <Skeleton className="h-7 w-24 max-w-full" />
              <Skeleton className="h-3 w-20 max-w-full" />
              <Skeleton className="h-2.5 w-28 max-w-full" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>

        <div className="-mx-4 overflow-hidden px-4 sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8">
          <div className="flex gap-3 2xl:grid 2xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, column) => (
              <div
                key={column}
                className="flex w-[min(18rem,calc(100vw-4rem))] shrink-0 flex-col rounded-2xl border bg-muted/30 md:w-72 2xl:w-auto"
              >
                <div className="flex items-start justify-between gap-2 border-b p-3">
                  <div className="min-w-0 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-2.5 w-40 max-w-full" />
                  </div>
                  <Skeleton className="h-3 w-10 shrink-0" />
                </div>
                <div className="flex min-h-40 flex-col gap-2 p-2">
                  {Array.from({ length: 2 - (column % 2) }, (_, card) => (
                    <div key={card} className="flex items-start gap-1.5 rounded-xl border bg-card p-2.5">
                      <Skeleton className="mt-0.5 size-6 shrink-0 rounded-md" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-28 max-w-full" />
                        <Skeleton className="h-3 w-24 max-w-full" />
                        <Skeleton className="h-2.5 w-20" />
                      </div>
                      <Skeleton className="size-6 shrink-0 rounded-md" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
