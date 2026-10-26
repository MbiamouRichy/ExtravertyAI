import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de la page : en-tête, compteurs, filtres puis tableau.
export default function AdminFeedbackLoading() {
  return (
    <PageLoading label="Chargement des retours…">
      <div className="flex min-w-0 flex-col gap-6">
        <header className="space-y-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-[32rem] max-w-full" />
        </header>
        <div className="grid gap-3 lg:grid-cols-2">
          {[4, 3].map((count) => (
            <div key={count} className="rounded-2xl border bg-card p-4">
              <Skeleton className="h-3 w-16" />
              <div className="mt-3 flex gap-4">
                {Array.from({ length: count }, (_, index) => (
                  <div key={index} className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-14 max-w-full" />
                    <Skeleton className="h-7 w-8" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
          <Skeleton className="h-9 w-full self-end rounded-md lg:w-40" />
        </div>
        <div className="rounded-2xl border bg-card">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-start gap-4 border-b p-4 last:border-b-0">
              <Skeleton className="h-4 w-16" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full max-w-xl" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    </PageLoading>
  );
}
