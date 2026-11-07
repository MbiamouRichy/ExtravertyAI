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
    <div className="mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex h-6 items-center">
        <Skeleton className={`h-4 ${title}`} />
      </div>
      {meta && (
        <div className="flex h-4 items-center">
          <Skeleton className={`h-3 ${meta} max-w-full`} />
        </div>
      )}
    </div>
  );
}

// Miroir du rapport hebdomadaire : semaine et navigation, résumé, actions,
// indicateurs en liste, conversations, attente et questions, puis envois.
export default function ReportsLoading() {
  return (
    <PageLoading
      label="Chargement des rapports…"
      className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10"
    >
      <div className="space-y-10 sm:space-y-12">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-44 max-w-full" />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pt-5">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </header>

        {/* Résumé */}
        <div className="space-y-3 rounded-2xl border p-5 sm:p-6">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-6 w-full max-w-2xl" />
          <Skeleton className="h-6 w-2/3 max-w-lg" />
        </div>

        {/* Actions de la semaine */}
        <div>
          <SectionHeaderSkeleton title="w-40" meta="w-56" />
          <div className="divide-y rounded-2xl border">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 p-4 sm:p-5 md:grid-cols-[1.5rem_minmax(0,1fr)_auto] md:items-center"
              >
                <Skeleton className="size-6 rounded-full" />
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-4 w-full max-w-md" />
                  <Skeleton className="h-3.5 w-4/5 max-w-sm" />
                  <Skeleton className="h-3 w-44 max-w-full" />
                </div>
                <Skeleton className="col-start-2 h-8 w-40 rounded-md md:col-start-3" />
              </div>
            ))}
          </div>
        </div>

        {/* Indicateurs */}
        <div>
          <SectionHeaderSkeleton title="w-24" meta="w-64" />
          <div className="divide-y rounded-2xl border">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 p-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_10rem_7rem] md:items-center"
              >
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-4 w-36 max-w-full" />
                  <Skeleton className="h-3 w-44 max-w-full" />
                </div>
                <Skeleton className="h-7 w-14 justify-self-end md:col-start-3" />
              </div>
            ))}
          </div>
        </div>

        {/* Conversations de la semaine */}
        <div>
          <SectionHeaderSkeleton title="w-52" meta="w-56" />
          <div className="space-y-4 rounded-2xl border p-4 sm:p-5">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="space-y-3 pt-1">
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3.5 w-40 max-w-[70%]" />
                  <Skeleton className="h-3.5 w-14" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* En attente et questions */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-6">
          {[0, 1].map((item) => (
            <div key={item}>
              <SectionHeaderSkeleton title="w-44" meta="w-32" />
              <div className="space-y-4 rounded-2xl border p-4 sm:p-5">
                <Skeleton className="h-8 w-48 max-w-full" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-3.5 w-36 max-w-[70%]" />
                    <Skeleton className="h-3.5 w-6" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                </div>
                <Skeleton className="h-8 w-44 rounded-md" />
              </div>
            </div>
          ))}
        </div>

        {/* Envoi par e-mail et destinataires */}
        <div className="grid grid-cols-1 gap-10 border-t pt-10 md:grid-cols-2 md:gap-6">
          <div className="min-w-0">
            <SectionHeaderSkeleton title="w-32" meta={null} />
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
            </div>
          </div>
          <div className="min-w-0">
            <SectionHeaderSkeleton title="w-24" meta="w-36" />
            <div className="divide-y rounded-2xl border px-4">
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
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
