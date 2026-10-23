import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de « Équipe et accès » : en-tête, rôles, puis liste des membres.
export default function TeamLoading() {
  return (
    <PageLoading
      label="Chargement de l’équipe…"
      className="mx-auto w-full max-w-5xl p-4 sm:p-6 xl:p-8"
    >
      <div className="space-y-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-60 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-9 w-full rounded-md sm:w-44" />
        </header>

        {/* Propriétaire, administrateurs, agents */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((role) => (
            <div key={role} className="space-y-3 rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="size-8 rounded-lg" />
                <Skeleton className="h-6 w-6" />
              </div>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>

        <div className="rounded-2xl border bg-card">
          <div className="flex flex-col justify-between gap-3 border-b p-4 sm:flex-row sm:items-center sm:px-5">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-9 w-full rounded-md sm:w-64" />
          </div>
          <div className="divide-y">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-start gap-3 px-4 py-3.5 sm:items-center sm:px-5">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36 max-w-full" />
                  <Skeleton className="h-3 w-48 max-w-full" />
                  <Skeleton className="h-3 w-32" />
                  {/* Mobile : bouton « Assigner » sous les informations */}
                  <Skeleton className="mt-2 h-8 w-24 rounded-md sm:hidden" />
                </div>
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                  <Skeleton className="size-8 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
