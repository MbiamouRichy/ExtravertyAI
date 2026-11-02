import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de la page Diffusions : en-tête, utilisation et liste.
export default function BroadcastsLoading() {
  return (
    <PageLoading label="Chargement des diffusions…" className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-9 w-40" />
        </header>
        <div className="space-y-4">
          <Skeleton className="h-9 w-56" />
          <div className="space-y-3 rounded-xl border p-4">
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-1.5 w-full" />
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-full" />
          </div>
          <div className="divide-y rounded-xl border">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="space-y-3 p-4">
                <div className="flex justify-between gap-3">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-56 max-w-full" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
