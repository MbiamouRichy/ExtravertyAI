import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de l’onglet ouvert par défaut : « Projet & utilisation ».
function CardHeading({ width = "w-48" }: { width?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className={`h-6 max-w-full ${width}`} />
      <Skeleton className="h-3.5 w-full max-w-sm" />
    </div>
  );
}

export default function SettingsLoading() {
  return (
    <PageLoading
      label="Chargement des paramètres du projet…"
      className="mx-auto w-full max-w-7xl p-4 sm:p-6 xl:p-8"
    >
      <div className="space-y-8">
        {/* En-tête : nom du projet, états et raccourcis */}
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="min-w-0 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-64 max-w-full" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-36 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-44 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Skeleton className="h-9 rounded-md sm:w-36" />
            <Skeleton className="h-9 rounded-md sm:w-32" />
          </div>
        </header>

        <div className="grid gap-7 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Navigation des sections */}
          <div className="grid grid-cols-2 gap-1.5 lg:flex lg:flex-col lg:gap-1">
            {Array.from({ length: 4 }, (_, item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-md border p-2 lg:gap-3 lg:border-transparent lg:px-3"
              >
                <Skeleton className="size-7 shrink-0 rounded-lg lg:size-8" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-20 lg:w-32" />
                  <Skeleton className="hidden h-3 w-36 max-w-full lg:block" />
                </div>
              </div>
            ))}
          </div>

          <div className="min-w-0 space-y-6">
            {/* Nom du projet */}
            <div className="space-y-6 rounded-2xl border bg-card p-4 sm:p-6">
              <CardHeading width="w-40" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-11 w-full rounded-md" />
              </div>
            </div>

            {/* Temps d’attente affiché */}
            <div className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6">
              <CardHeading width="w-56" />
              <div className="flex items-start gap-4">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 max-w-full" />
                  <Skeleton className="h-3 w-full max-w-md" />
                </div>
                <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
              </div>
            </div>

            {/* Utilisation et abonnement */}
            <div className="rounded-2xl border bg-card p-4 sm:p-6">
              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <CardHeading width="w-44" />
                <Skeleton className="h-10 w-full rounded-md sm:w-52" />
              </div>
              <div className="mb-3 flex justify-between gap-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
              <div className="mt-7 grid grid-cols-3 gap-4 border-t pt-6">
                {[0, 1, 2].map((stat) => (
                  <div key={stat} className="space-y-2">
                    <Skeleton className="h-3 w-20 max-w-full" />
                    <Skeleton className="h-7 w-14" />
                    <Skeleton className="h-2.5 w-24 max-w-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
