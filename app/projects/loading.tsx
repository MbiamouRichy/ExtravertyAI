import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de « Vos projets », aux mêmes hauteurs de ligne que la page : la
// carte suit la même requête de conteneur (@md/card), offre et actions en
// colonne sur une carte étroite, en ligne dès qu'elle s'élargit.
function ProjectCardSkeleton() {
  return (
    <li className="@container/card flex min-w-0 flex-col rounded-2xl border bg-card">
      <div className="flex min-w-0 items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <div className="flex h-6 items-center">
              <Skeleton className="h-4 w-32 max-w-full" />
            </div>
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </div>
        <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
      </div>

      <div className="min-w-0 space-y-4 px-4 pb-5 sm:px-5">
        {/* Connexion WhatsApp : icône, état et précision. */}
        <div className="flex items-start gap-2">
          <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
          <div className="min-w-0 space-y-1">
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
          </div>
        </div>
        {/* Messages utilisés. */}
        <div>
          <div className="mb-1.5 flex h-4 items-center justify-between gap-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      </div>

      <div className="mt-auto flex min-w-0 flex-col gap-3 border-t px-4 py-3 sm:px-5 @md/card:flex-row @md/card:items-center @md/card:justify-between @md/card:gap-2">
        <div className="flex h-4 min-w-0 items-center gap-1.5">
          <Skeleton className="size-3.5 shrink-0 rounded-sm" />
          <Skeleton className="h-3 w-40 max-w-full" />
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1">
          <Skeleton className="mr-1 h-8 flex-1 rounded-md @md/card:w-24 @md/card:flex-none" />
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <Skeleton className="size-8 shrink-0 rounded-md" />
        </div>
      </div>
    </li>
  );
}

export default function ProjectsLoading() {
  return (
    <PageLoading
      label="Chargement des projets…"
      className="mx-auto w-full min-w-0 max-w-7xl flex-1 p-4 sm:p-6 lg:p-8"
    >
      <div className="flex min-w-0 flex-col gap-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="mt-1 flex h-9 items-center md:h-10">
              <Skeleton className="h-7 w-52 max-w-full md:h-8 md:w-64" />
            </div>
            {/* Une phrase : deux lignes sur mobile, une seule dès sm. */}
            <div className="mt-2 space-y-1.5 py-0.5 sm:space-y-0">
              <Skeleton className="h-3.5 w-full max-w-md" />
              <Skeleton className="h-3.5 w-2/3 sm:hidden" />
            </div>
          </div>
          <Skeleton className="h-9 w-full shrink-0 rounded-md sm:w-36" />
        </header>

        <div className="grid grid-cols-3 divide-x rounded-2xl border bg-card">
          {[0, 1, 2].map((index) => (
            <div key={index} className="min-w-0 px-3 py-4 sm:px-6">
              <div className="flex h-4 items-center">
                <Skeleton className="h-3 w-16 max-w-full sm:w-28" />
              </div>
              <div className="mt-1 flex h-7 items-center sm:h-8">
                <Skeleton className="h-5 w-10 sm:h-6 sm:w-14" />
              </div>
            </div>
          ))}
        </div>

        <ul className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
          <li className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-3.5 w-28" />
          </li>
        </ul>
      </div>
    </PageLoading>
  );
}
