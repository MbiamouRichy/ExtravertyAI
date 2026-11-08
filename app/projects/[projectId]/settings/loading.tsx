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

/**
 * Carte à interrupteur (Messagerie, Répartition) : sur mobile, titre et
 * interrupteur sur une ligne puis le texte en pleine largeur ; dès sm, le
 * pictogramme à gauche et le texte sous le titre.
 */
function SwitchCardSkeleton({ heading, label }: { heading: string; label: string }) {
  return (
    <div className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6">
      <CardHeading width={heading} />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <Skeleton className="hidden size-9 rounded-lg sm:row-span-2 sm:block" />
        <div className="flex h-6 items-center sm:h-5">
          <Skeleton className={`h-4 max-w-full ${label}`} />
        </div>
        <div className="flex h-6 items-center sm:h-5">
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
        <div className="col-span-2 space-y-1.5 sm:col-span-1 sm:col-start-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      </div>
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
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:flex">
            <Skeleton className="h-9 rounded-md sm:w-36" />
            <Skeleton className="h-9 rounded-md sm:w-32" />
          </div>
        </header>

        <div className="grid gap-7 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Navigation des sections : 2 × 2 sur mobile, la première active.
              Les barres restent dans leur case, quelle que soit la largeur. */}
          <div className="grid grid-cols-2 gap-1.5 lg:flex lg:flex-col lg:gap-1">
            {Array.from({ length: 4 }, (_, item) => (
              <div
                key={item}
                className={`flex min-w-0 items-center gap-2 overflow-hidden rounded-md p-2 lg:gap-3 lg:px-3 ${
                  item === 0 ? "bg-muted/60" : "border lg:border-transparent"
                }`}
              >
                <Skeleton className="size-7 shrink-0 rounded-lg lg:size-8" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-full max-w-16 sm:max-w-24 lg:max-w-32" />
                  <Skeleton className="hidden h-3 w-full max-w-36 lg:block" />
                </div>
              </div>
            ))}
          </div>

          <div className="min-w-0 space-y-6">
            {/* Identité du projet : logo (aperçu, texte, action), puis nom. */}
            <div className="rounded-2xl border bg-card p-4 sm:p-6">
              <CardHeading width="w-44" />
              <div className="mt-5 space-y-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="size-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2.5 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-3 w-full max-w-40" />
                    </div>
                    <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
            </div>

            {/* Messagerie : temps d’attente des clients */}
            <SwitchCardSkeleton heading="w-32" label="w-48" />

            {/* Fuseau horaire */}
            <div className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6">
              <CardHeading width="w-36" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-10 w-full rounded-md sm:max-w-sm" />
              </div>
            </div>

            {/* Répartition des conversations */}
            <SwitchCardSkeleton heading="w-52" label="w-44" />

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
              {/* « Messages envoyés », puis les trois chiffres alignés. */}
              <div className="mt-7 border-t pt-6">
                <Skeleton className="h-3 w-32" />
                <div className="mt-3 grid grid-cols-3 gap-4">
                  {[0, 1, 2].map((stat) => (
                    <div key={stat} className="space-y-2">
                      <Skeleton className="h-7 w-12" />
                      <Skeleton className="h-3 w-16 max-w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
