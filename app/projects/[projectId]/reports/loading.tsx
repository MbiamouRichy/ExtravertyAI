import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

/** Titre de section : la précision passe sous le titre sur mobile. */
function SectionHeaderSkeleton({
  title = "w-28",
  meta = "w-48",
}: {
  title?: string;
  meta?: string | null;
}) {
  return (
    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex h-5 items-center">
        <Skeleton className={`h-3.5 ${title}`} />
      </div>
      {meta && (
        <div className="flex h-5 items-center">
          <Skeleton className={`h-3 ${meta} max-w-full`} />
        </div>
      )}
    </div>
  );
}

// Miroir du rapport hebdomadaire : en-tête et navigation entre semaines,
// verdict, actions, indicateurs, puis programmation et destinataires
// (empilés sur mobile, côte à côte dès md).
export default function ReportsLoading() {
  return (
    <PageLoading
      label="Chargement des rapports…"
      className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10"
    >
      <div className="space-y-14">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="w-full max-w-xl space-y-2">
            <Skeleton className="h-3.5 w-56 max-w-full" />
            <Skeleton className="h-8 w-44" />
            <div className="space-y-2 pt-1">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
        </header>

        {/* Verdict */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-7 w-full max-w-3xl sm:h-8" />
          <Skeleton className="h-7 w-2/3 max-w-xl sm:h-8" />
        </div>

        {/* Actions de la semaine */}
        <div>
          <SectionHeaderSkeleton title="w-36" meta="w-56" />
          <div className="divide-y border-y">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="grid gap-4 py-5 sm:grid-cols-[2.5rem_1fr_auto] sm:items-start"
              >
                <Skeleton className="hidden h-3 w-5 sm:block" />
                <div className="min-w-0 space-y-2.5">
                  <Skeleton className="h-5 w-full max-w-md" />
                  <Skeleton className="h-3.5 w-full max-w-lg" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-8 w-40 rounded-md" />
              </div>
            ))}
          </div>
        </div>

        {/* Indicateurs */}
        <div>
          <SectionHeaderSkeleton title="w-24" meta="w-80" />
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="space-y-3 bg-background p-5">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Programmation et destinataires */}
        <div className="grid grid-cols-1 gap-10 border-t pt-10 md:grid-cols-2">
          <div className="min-w-0">
            <SectionHeaderSkeleton title="w-28" meta={null} />
            <Skeleton className="mb-5 h-3.5 w-56 max-w-full" />
            <div className="space-y-7">
              {[0, 1, 2].map((item) => (
                <div key={item} className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <Skeleton className="h-3.5 w-52 max-w-[70%]" />
                    <Skeleton className="h-5 w-8 shrink-0 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
              <div className="space-y-3">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex">
              <Skeleton className="h-9 rounded-md sm:w-28" />
              <Skeleton className="h-9 rounded-md sm:w-52" />
            </div>
          </div>
          <div className="min-w-0">
            <SectionHeaderSkeleton title="w-24" meta="w-36" />
            <div className="divide-y border-y">
              {[0, 1].map((item) => (
                <div key={item} className="flex items-center gap-3 py-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-3 w-44 max-w-full" />
                  </div>
                </div>
              ))}
            </div>
            <Skeleton className="mt-4 h-8 w-32 rounded-md" />
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
