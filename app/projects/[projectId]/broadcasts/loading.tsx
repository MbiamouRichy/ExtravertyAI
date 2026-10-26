import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de la page Diffusions : en-tête, utilisation et liste.
export default function BroadcastsLoading() {
  return (
    <PageLoading label="Chargement des diffusions…" className="mx-auto w-full max-w-6xl p-4 sm:p-6 xl:p-8">
      <div className="space-y-6">
        <header className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-9 w-80 max-w-full" />
          <Skeleton className="h-4 w-[32rem] max-w-full" />
        </header>
        <div className="flex flex-col gap-5 rounded-2xl border p-4 sm:flex-row sm:p-5">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex-1 space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-9 w-40" />
        </div>
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-2xl border p-4 sm:p-5">
            <div className="flex justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </PageLoading>
  );
}
