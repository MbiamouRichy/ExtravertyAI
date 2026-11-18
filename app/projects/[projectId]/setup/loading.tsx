import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de la première étape du parcours (Entreprise) : mêmes marges, même
// progression, mêmes hauteurs de champs et barre d’actions collée en bas, pour
// que rien ne bouge à l’arrivée du formulaire.

const STEPS = 6;

function FieldBone({ tall }: { tall?: boolean }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-36" />
      <Skeleton className={tall ? "h-28 w-full rounded-md" : "h-11 w-full rounded-md"} />
    </div>
  );
}

export default function SetupLoading() {
  return (
    <PageLoading
      label="Chargement de la configuration de votre assistant…"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-4 sm:px-6 sm:pt-6 xl:px-8 xl:pt-8"
    >
      {/* Retour aux projets, projet en cours */}
      <div className="mb-10 flex h-8 items-center justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-6 shrink-0 rounded-md" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      <div className="space-y-8">
        {/* Progression : barres seules sur téléphone et tablette */}
        <div
          className="grid gap-1.5 sm:gap-2"
          style={{ gridTemplateColumns: `repeat(${STEPS}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: STEPS }, (_, step) => (
            <div key={step} className="min-w-0 py-1">
              <Skeleton className="h-1 rounded-full" />
              <Skeleton className="mt-2 h-3 w-3/4 max-md:hidden" />
            </div>
          ))}
        </div>

        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-64 max-w-full sm:h-9" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2.5 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
        <FieldBone />
        <FieldBone />
        <FieldBone tall />
        {/* Présence en ligne */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t bg-background/90 px-4 py-3 sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8">
        <div className="flex justify-end">
          <Skeleton className="h-9 w-full rounded-md sm:w-32" />
        </div>
      </div>
    </PageLoading>
  );
}
