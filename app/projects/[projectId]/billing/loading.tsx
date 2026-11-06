import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de la page Facturation : en-tête et actions (empilées pleine largeur
// sur mobile), carte de l’offre et ses trois repères, paiement, puis factures
// en liste sur mobile et en tableau dès sm. Mêmes boîtes de ligne que la page
// (paragraphes en leading-relaxed) pour un remplacement sans décalage.
export default function BillingLoading() {
  return (
    <PageLoading
      label="Chargement de la facturation…"
      className="mx-auto w-full max-w-4xl p-4 sm:p-6 xl:p-8"
    >
      <div className="space-y-8 sm:space-y-10">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <div className="flex h-5.5 items-center">
              <Skeleton className="h-3.5 w-32" />
            </div>
            <div className="mt-1 flex h-6.5 items-center sm:h-8">
              <Skeleton className="h-6 w-40 sm:h-7 sm:w-48" />
            </div>
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
            <Skeleton className="h-10 rounded-md sm:h-9 sm:w-44" />
            <Skeleton className="h-10 rounded-md sm:h-9 sm:w-48" />
          </div>
        </header>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <div className="flex h-7 items-center">
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <div className="mt-1 flex h-5.5 items-center">
              <Skeleton className="h-3.5 w-36" />
            </div>
          </div>
          <div className="grid grid-cols-1 border-t max-sm:divide-y sm:grid-cols-3 sm:divide-x">
            {["w-28", "w-24"].map((label) => (
              <div key={label} className="px-4 py-3.5 sm:p-6">
                <div className="flex h-4 items-center">
                  <Skeleton className={`h-3 ${label}`} />
                </div>
                <div className="mt-1 flex h-5 items-center">
                  <Skeleton className="h-3.5 w-32 max-w-full" />
                </div>
              </div>
            ))}
            <div className="px-4 py-3.5 sm:p-6">
              <div className="flex h-4 items-center">
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="mt-1 flex h-5.5 items-center">
                <Skeleton className="h-3.5 w-20" />
              </div>
              <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
              <div className="mt-2 space-y-2 py-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-20" />
          </div>
          <div className="divide-y rounded-xl border bg-card">
            <div className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:gap-6 sm:p-5">
              <div className="flex h-5 items-center sm:w-40 sm:shrink-0">
                <Skeleton className="h-3.5 w-36" />
              </div>
              <div className="flex h-5 items-center gap-3">
                <Skeleton className="size-4 rounded-sm" />
                <Skeleton className="h-3.5 w-28" />
              </div>
            </div>
            <div className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:gap-6 sm:p-5">
              <div className="flex h-5 items-center sm:w-40 sm:shrink-0">
                <Skeleton className="h-3.5 w-20" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex h-5.5 items-center">
                  <Skeleton className="h-3.5 w-32" />
                </div>
                <div className="flex h-5.5 items-center">
                  <Skeleton className="h-3.5 w-52 max-w-full" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-20" />
          </div>
          <div className="overflow-hidden rounded-xl border bg-card">
            {/* Mobile : date et montant, puis statut et numéro avec le document. */}
            <div className="divide-y sm:hidden">
              {[0, 1].map((row) => (
                <div
                  key={row}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3"
                >
                  <div className="flex h-5.5 items-center">
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                  <div className="flex h-5.5 items-center justify-end">
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                  <div className="flex h-5 items-center">
                    <Skeleton className="h-3 w-32 max-w-full" />
                  </div>
                  <Skeleton className="h-8 w-14 rounded-md" />
                </div>
              ))}
            </div>
            <div className="max-sm:hidden">
              <div className="flex h-10 items-center gap-6 border-b px-5">
                {["w-10", "w-14", "w-14", "w-12"].map((width, index) => (
                  <Skeleton key={index} className={`h-3 ${width}`} />
                ))}
              </div>
              <div className="divide-y">
                {[0, 1].map((row) => (
                  <div key={row} className="flex h-12 items-center gap-6 px-5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3.5 w-16" />
                    <Skeleton className="h-3.5 w-12" />
                    <Skeleton className="ml-auto h-8 w-16 rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageLoading>
  );
}
