import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de la page : en-tête, chiffres, recherche, projets puis historique.
export default function AdminPaymentsLoading() {
  return (
    <PageLoading label="Chargement des paiements…">
      <div className="flex min-w-0 flex-col gap-6">
        <header className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-[32rem] max-w-full" />
        </header>
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-2 rounded-2xl border bg-card p-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-9 flex-1 rounded-md" />
          <Skeleton className="h-9 w-full rounded-md sm:w-32" />
        </div>
        <div className="rounded-2xl border bg-card">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 border-b p-4 last:border-b-0">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
              <Skeleton className="hidden h-8 w-44 rounded-md sm:block" />
            </div>
          ))}
        </div>
      </div>
    </PageLoading>
  );
}
