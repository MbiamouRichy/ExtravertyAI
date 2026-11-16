import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

const CARD = "min-w-0 rounded-xl border bg-card";

/** Ligne de facture : icône, libellé et date, montant, bouton PDF. */
function InvoiceRowSkeleton({ width }: { width: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
      <Skeleton className="hidden size-9 shrink-0 rounded-lg sm:block" />
      <div className="min-w-0 flex-1">
        <div className="flex h-5 items-center">
          <Skeleton className={`h-3.5 max-w-full ${width}`} />
        </div>
        <div className="flex h-4 items-center">
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-3.5 w-14 shrink-0" />
      <Skeleton className="-mr-2 h-8 w-8 shrink-0 rounded-md sm:w-14" />
    </div>
  );
}

// Miroir de la page Facturation, avec les mêmes hauteurs de ligne pour un
// remplacement sans saut : offre (3/5) et crédit (2/5) côte à côte quand la
// zone de contenu est assez large (@4xl), liste unique des factures, puis
// paiement.
export default function BillingLoading() {
  return (
    <PageLoading
      label="Chargement de la facturation…"
      className="mx-auto w-full max-w-5xl p-4 sm:p-6 xl:p-8"
    >
      <div className="space-y-8">
        <header className="min-w-0">
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="mt-1 flex h-8 items-center sm:h-9">
            <Skeleton className="h-6 w-40 sm:h-7 sm:w-48" />
          </div>
        </header>

        <div className="@container">
          <div className="grid gap-4 @4xl:grid-cols-5">
            {/* Offre : libellé et statut, nom, tarif ; quota et action en pied. */}
            <section className={`${CARD} flex flex-col @4xl:col-span-3`}>
              <div className="p-4 sm:p-6">
                <div className="flex h-6 items-center justify-between gap-3">
                  <Skeleton className="h-3.5 w-12" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <div className="mt-2 flex h-8 items-center">
                  <Skeleton className="h-6 w-32" />
                </div>
                <div className="mt-1 flex h-5 items-center">
                  <Skeleton className="h-3.5 w-72 max-w-full" />
                </div>
              </div>
              <div className="mt-auto flex min-h-18 flex-col justify-center gap-4 border-t px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
                <div className="min-w-0 flex-1">
                  <div className="flex h-5 items-center justify-between gap-3">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                  <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
                </div>
                <Skeleton className="h-10 w-full shrink-0 rounded-md sm:h-9 sm:w-36" />
              </div>
            </section>

            {/* Crédit : libellé, solde, équivalent en messages ; achat en pied. */}
            <section className={`${CARD} flex flex-col @4xl:col-span-2`}>
              <div className="p-4 sm:p-6">
                <div className="flex h-6 items-center">
                  <Skeleton className="h-3.5 w-28" />
                </div>
                <div className="mt-2 flex h-8 items-center">
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="mt-1 flex h-5 items-center">
                  <Skeleton className="h-3.5 w-48 max-w-full" />
                </div>
              </div>
              <div className="mt-auto flex min-h-18 flex-col justify-center border-t px-4 py-4 sm:items-end sm:px-6 @4xl:items-stretch">
                <Skeleton className="h-10 w-full rounded-md sm:h-9 sm:w-60 @4xl:w-full" />
              </div>
            </section>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex h-6 items-center">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className={`${CARD} divide-y overflow-hidden`}>
            {["w-40", "w-36", "w-44"].map((width) => (
              <InvoiceRowSkeleton key={width} width={width} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex h-6 items-center">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className={`${CARD} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6`}>
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="min-w-0">
                <div className="flex h-5 items-center">
                  <Skeleton className="h-3.5 w-36" />
                </div>
                <div className="flex h-4 items-center">
                  <Skeleton className="h-3 w-52 max-w-full" />
                </div>
              </div>
            </div>
            <Skeleton className="h-10 w-full shrink-0 rounded-md sm:h-9 sm:w-40" />
          </div>
        </section>
      </div>
    </PageLoading>
  );
}
