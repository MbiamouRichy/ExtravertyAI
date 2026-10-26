import { Skeleton } from "@/components/ui/skeleton";

/** Reprend la grille des sections : titre à gauche, contenu à droite. */
function SectionSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 border-t pt-8 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-full max-w-56" />
        <Skeleton className="h-3.5 w-2/3 max-w-40" />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Row() {
  return (
    <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3.5 w-52 max-w-full" />
      </div>
      <Skeleton className="h-8 w-40 rounded-lg" />
    </div>
  );
}

export default function UserLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Chargement du profil"
      className="relative mx-auto w-full max-w-5xl p-4 sm:p-6 xl:p-8"
    >
      <p role="status" className="sr-only">
        Chargement du profil…
      </p>
      <div aria-hidden="true" className="skeleton-shimmer space-y-10">
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-muted">
          <div className="loading-bar h-full w-1/3 rounded-full bg-foreground/50" />
        </div>

        <header className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-full max-w-md" />
        </header>

        <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-3xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_top_left,black,transparent_60%)] bg-size-[18px_18px]" />
          <div className="flex min-w-0 items-center gap-4">
            <Skeleton className="size-16 shrink-0 rounded-full sm:size-20" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-6 w-44 max-w-full" />
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Skeleton className="h-9 w-full rounded-lg sm:w-40" />
            <Skeleton className="h-9 w-full rounded-lg sm:w-32" />
          </div>
        </div>

        <SectionSkeleton>
          <div className="divide-y rounded-2xl border bg-card">
            <Row />
            <Row />
          </div>
        </SectionSkeleton>

        <SectionSkeleton>
          <div className="space-y-4 rounded-2xl border bg-card p-5">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40 max-w-full" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </SectionSkeleton>

        <SectionSkeleton>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-20 rounded-xl" />
            ))}
          </div>
        </SectionSkeleton>

        <SectionSkeleton>
          <div className="rounded-2xl border border-dashed p-5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-2 h-3.5 w-full max-w-sm" />
            <Skeleton className="mt-4 h-9 w-44 rounded-lg" />
          </div>
        </SectionSkeleton>
      </div>
    </main>
  );
}
