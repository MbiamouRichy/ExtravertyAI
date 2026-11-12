import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de la page : en-tête et mois, quatre tuiles, usages puis projets.
export default function AdminAiCostsLoading() {
  return (
    <PageLoading label="Chargement des coûts IA…">
      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-[32rem] max-w-full" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </header>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="rounded-2xl border bg-card p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-8 w-28" />
              <Skeleton className="mt-2 h-3 w-36 max-w-full" />
            </div>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border bg-card">
            <div className="space-y-1.5 border-b px-4 py-3 sm:px-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-52 max-w-full" />
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex justify-between gap-3">
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-3.5 w-14" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-card lg:col-span-2">
            <div className="space-y-1.5 border-b px-4 py-3 sm:px-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-48 max-w-full" />
            </div>
            <div className="divide-y px-4 sm:px-5">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40 max-w-full" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
