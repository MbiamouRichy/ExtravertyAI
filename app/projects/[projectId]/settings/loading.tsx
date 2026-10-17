import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

function EditorCard({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-6 w-56 max-w-full" />
          <Skeleton className="h-3.5 w-full max-w-sm" />
        </div>
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
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
        {/* En-tête : nom du projet et états */}
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="min-w-0 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-64 max-w-full" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-40 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-lg sm:w-48" />
        </header>

        <div className="grid gap-7 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Navigation des sections */}
          <div className="grid grid-cols-2 gap-1.5 lg:flex lg:flex-col lg:gap-1">
            {Array.from({ length: 4 }, (_, item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg border p-2 lg:border-transparent lg:px-3"
              >
                <Skeleton className="size-7 shrink-0 rounded-lg lg:size-8" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-20 lg:w-28" />
                  <Skeleton className="hidden h-3 w-36 max-w-full lg:block" />
                </div>
              </div>
            ))}
          </div>

          {/* Éditeur de l’agent et aperçu */}
          <div className="grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-6">
              <EditorCard rows={1} />
              <div className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-6 w-52 max-w-full" />
                  </div>
                </div>
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-1 flex-1 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
                <Skeleton className="h-6 w-56 max-w-full" />
                <div className="grid gap-2 sm:grid-cols-3">
                  {[0, 1, 2].map((tone) => (
                    <Skeleton key={tone} className="h-28 rounded-xl" />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((length) => (
                    <Skeleton key={length} className="h-20 rounded-xl" />
                  ))}
                </div>
              </div>
            </div>

            <aside className="hidden space-y-4 self-start rounded-2xl border bg-card p-4 xl:block">
              <Skeleton className="h-3 w-28" />
              <div className="overflow-hidden rounded-2xl border">
                <div className="flex items-center gap-3 border-b p-3">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  <Skeleton className="h-8 w-24 rounded-2xl" />
                  <Skeleton className="ml-auto h-24 w-52 rounded-2xl" />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[20, 16, 28, 24].map((width, chip) => (
                  <Skeleton
                    key={chip}
                    className="h-6 rounded-full"
                    style={{ width: `${width * 4}px` }}
                  />
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
