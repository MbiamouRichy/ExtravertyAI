import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de « Vos projets » : en-tête, bandeau de chiffres et grille de cartes.
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
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-9 w-full rounded-md sm:w-40" />
        </header>

        <div className="grid grid-cols-3 divide-x rounded-2xl border bg-card">
          {[0, 1, 2].map((index) => (
            <div key={index} className="min-w-0 space-y-2 px-3 py-4 sm:px-6">
              <Skeleton className="h-3 w-16 max-w-full" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>

        <ul className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <li key={index} className="flex min-w-0 flex-col rounded-2xl border bg-card">
              <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-xl" />
                  <div className="min-w-0 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
              </div>
              <div className="space-y-4 px-4 pb-5 sm:px-5">
                <div className="flex items-start gap-2">
                  <Skeleton className="size-4 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 border-t px-4 py-3 sm:px-5">
                <Skeleton className="h-3 w-40 max-w-[60%]" />
                <div className="flex gap-1">
                  <Skeleton className="size-8 rounded-md" />
                  <Skeleton className="size-8 rounded-md" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </PageLoading>
  );
}
