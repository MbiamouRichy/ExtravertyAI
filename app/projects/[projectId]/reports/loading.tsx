import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

export default function ReportsLoading() {
  return (
    <PageLoading
      label="Chargement des rapports…"
      className="mx-auto w-full max-w-7xl p-4 sm:p-6 xl:p-8"
    >
      <div className="space-y-8">
        <header className="space-y-3">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </header>

        {/* Points clés */}
        <div className="grid divide-y rounded-2xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex gap-3 p-5">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full max-w-48" />
              </div>
            </div>
          ))}
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-3">
          <div className="space-y-10 lg:col-span-2">
            {/* Dernier rapport */}
            <div>
              <div className="mb-5 space-y-2">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-3.5 w-72 max-w-full" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, metric) => (
                  <div key={metric} className="rounded-2xl border bg-card p-5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="mt-3 h-9 w-20" />
                    <Skeleton className="mt-3 h-5 w-24 rounded-full" />
                  </div>
                ))}
              </div>
            </div>

            {/* Historique */}
            <div>
              <Skeleton className="mb-4 h-7 w-40" />
              <div className="divide-y overflow-hidden rounded-2xl border bg-card">
                {Array.from({ length: 4 }, (_, row) => (
                  <div key={row} className="flex items-center gap-4 px-4 py-3.5">
                    <Skeleton className="size-11 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-48 max-w-full" />
                      <div className="flex gap-1.5">
                        <Skeleton className="h-4 w-20 rounded-full" />
                        <Skeleton className="h-4 w-16 rounded-full" />
                      </div>
                    </div>
                    <Skeleton className="size-4 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Destinataires */}
          <aside className="space-y-4 rounded-2xl border bg-card p-5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
            <div className="space-y-3 pt-2">
              {[0, 1, 2].map((recipient) => (
                <div key={recipient} className="flex items-center gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <Skeleton className="h-3.5 flex-1" />
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
              ))}
            </div>
            <Skeleton className="h-9 w-full rounded-lg" />
          </aside>
        </div>
      </div>
    </PageLoading>
  );
}
