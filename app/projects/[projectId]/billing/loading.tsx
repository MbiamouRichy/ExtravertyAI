import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de la page Facturation : en-tête, offre + consommation, moyens de
// paiement et factures, pour un remplacement sans décalage.
export default function BillingLoading() {
  return (
    <PageLoading
      label="Chargement de la facturation…"
      className="mx-auto w-full max-w-6xl p-4 sm:p-6 xl:p-8"
    >
      <div className="space-y-8">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-9 w-80 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Skeleton className="col-span-2 h-9 sm:col-span-1 sm:w-40" />
            <Skeleton className="h-9 sm:w-36" />
            <Skeleton className="h-9 sm:w-44" />
          </div>
        </header>

        <section className="grid overflow-hidden rounded-3xl border lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-6 bg-primary p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-28 bg-primary-foreground/15" />
              <Skeleton className="h-5 w-14 rounded-full bg-primary-foreground/15" />
            </div>
            <Skeleton className="h-10 w-40 bg-primary-foreground/15" />
            <Skeleton className="h-7 w-48 bg-primary-foreground/15" />
            <div className="grid gap-4 border-t border-primary-foreground/15 pt-5 sm:grid-cols-2">
              {[0, 1].map((index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-24 bg-primary-foreground/15" />
                  <Skeleton className="h-4 w-40 bg-primary-foreground/15" />
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-3/4 bg-primary-foreground/15" />
          </div>
          <div className="flex flex-col gap-4 bg-card p-6 sm:p-8">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-10 w-52 max-w-full" />
            <Skeleton className="h-2.5 w-full rounded-full" />
            <Skeleton className="h-4 w-44" />
            <div className="mt-auto space-y-2 border-t pt-4">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((index) => (
            <div key={index} className="space-y-4 rounded-2xl border bg-card p-5">
              <Skeleton className="h-5 w-48 max-w-full" />
              <div className="flex items-center gap-4">
                {index === 0 && <Skeleton className="h-10 w-14 rounded-md" />}
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="space-y-2 border-b p-5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <div className="divide-y">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 px-5 py-4 sm:grid-cols-5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="hidden h-3.5 w-20 sm:block" />
                <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
                <Skeleton className="h-7 w-16 justify-self-end rounded-md" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageLoading>
  );
}
