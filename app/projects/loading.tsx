import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de « Vos projets » : en-tête, chiffres, cartes puis tuile « Nouveau projet ».
function ProjectCardSkeleton() {
  return (
    <li className="flex min-w-0 flex-col rounded-2xl border bg-card">
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-4 w-32 max-w-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="h-5 w-12 shrink-0 rounded-full" />
      </div>
      <div className="space-y-4 px-4 pb-5 sm:px-5">
        {/* Connexion WhatsApp */}
        <div className="flex items-start gap-2">
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        {/* Messages utilisés */}
        <div className="space-y-1.5">
          <div className="flex justify-between gap-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      </div>
      {/* Offre, échéance, renouvellement et actions */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Skeleton className="size-3.5 shrink-0 rounded-sm" />
          <Skeleton className="h-3 w-36 max-w-full" />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Skeleton className="mr-1 h-8 w-24 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      </div>
    </li>
  );
}

export default function ProjectsLoading() {
  return (
    <PageLoading
      label="Chargement des projets…"
      className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8"
    >
      <div className="flex min-w-0 flex-col gap-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-9 w-52 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-9 w-full rounded-md sm:w-40" />
        </header>

        <div className="grid grid-cols-3 divide-x rounded-2xl border bg-card">
          {[0, 1, 2].map((index) => (
            <div key={index} className="min-w-0 space-y-2 px-3 py-4 sm:px-6">
              <Skeleton className="h-3 w-20 max-w-full" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>

        <ul className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
          <li className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-4 w-28" />
          </li>
        </ul>
      </div>
    </PageLoading>
  );
}
