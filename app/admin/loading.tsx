import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir du tableau de bord : en-tête, tuiles, graphiques puis classements.
export default function AdminDashboardLoading() {
  return (
    <PageLoading label="Chargement du tableau de bord…">
      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-9 w-64 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-9 w-80 max-w-full rounded-lg" />
        </header>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="rounded-2xl border bg-card p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-8 w-24" />
              <Skeleton className="mt-4 h-4 w-32 max-w-full" />
            </div>
          ))}
        </div>
        {[0, 1, 2].map((row) => (
          <div key={row} className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border bg-card p-5 lg:col-span-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-6 h-56 w-full" />
            </div>
            <div className="rounded-2xl border bg-card p-5">
              <Skeleton className="h-4 w-24" />
              <div className="mt-6 space-y-3">
                {[80, 55, 30].map((width) => (
                  <Skeleton key={width} className="h-8" style={{ width: `${width}%` }} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageLoading>
  );
}
