import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir du pipeline : en-tête, indicateurs et cinq colonnes.
export default function PipelineLoading() {
  return (
    <PageLoading
      label="Chargement du pipeline…"
      className="mx-auto w-full max-w-400 p-4 sm:p-6 xl:p-8"
    >
      <div className="space-y-6">
        <header className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </header>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-2 p-4">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="flex gap-3 overflow-hidden 2xl:grid 2xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, column) => (
            <div key={column} className="w-72 shrink-0 space-y-2 rounded-2xl border p-3 2xl:w-auto">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-36" />
              {Array.from({ length: 3 - (column % 2) }, (_, card) => (
                <Skeleton key={card} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </PageLoading>
  );
}
