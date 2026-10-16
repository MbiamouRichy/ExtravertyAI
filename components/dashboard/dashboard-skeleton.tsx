import { Skeleton } from "@/components/ui/skeleton";

function SectionTitle() {
  return (
    <div className="mb-4 space-y-1.5">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-3.5 w-64 max-w-full" />
    </div>
  );
}

/** Silhouette de courbe (aire lissée) : plus proche du rendu final qu’une suite de barres. */
function ChartSilhouette({ variant = 0 }: { variant?: number }) {
  const paths = [
    "M0,70 C25,52 45,78 75,58 S125,22 160,40 S220,72 255,46 S290,30 300,34 L300,100 L0,100 Z",
    "M0,60 C30,72 55,40 85,48 S140,74 175,52 S235,18 265,30 S292,44 300,40 L300,100 L0,100 Z",
  ];
  return (
    <div className="relative h-52 sm:h-60">
      <div className="absolute inset-0 flex flex-col justify-between">
        {[0, 1, 2, 3].map((line) => (
          <div key={line} className="border-t border-dashed border-border/70" />
        ))}
      </div>
      <Skeleton className="absolute inset-0 rounded-md bg-transparent">
        <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="size-full">
          <path d={paths[variant % paths.length]} className="fill-muted" />
        </svg>
      </Skeleton>
      <div className="absolute inset-x-0 -bottom-6 flex justify-between">
        {[0, 1, 2, 3, 4, 5].map((tick) => (
          <Skeleton key={tick} className="h-2.5 w-8" />
        ))}
      </div>
    </div>
  );
}

function Panel({ chart, variant = 0 }: { chart?: boolean; variant?: number }) {
  return (
    <div className="min-w-0 rounded-2xl border bg-card p-5">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-44 max-w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
      </div>
      {chart ? (
        <div className="pb-6">
          <ChartSilhouette variant={variant} />
        </div>
      ) : (
        <ul className="space-y-4">
          {[0, 1, 2, 3].map((row) => (
            <li key={row} className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className={row % 2 ? "h-3 w-1/2" : "h-3 w-2/3"} />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
              <Skeleton className="h-5 w-12 shrink-0 rounded-full" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Miroir du tableau de bord : en-tête, vue d’ensemble, activité, contacts,
// puis actions rapides en bas de page.
export function DashboardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Tableau de bord"
      className="skeleton-shimmer relative mx-auto w-full min-w-0 max-w-(--breakpoint-2xl) p-4 md:p-6 xl:p-8"
    >
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
        <div className="loading-bar h-full w-1/3 rounded-full bg-foreground/50" />
      </div>
      <p role="status" className="sr-only">
        Chargement du tableau de bord…
      </p>

      <div aria-hidden="true" className="space-y-8">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-56 max-w-full" />
            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="size-4 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-32" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Skeleton className="h-9 rounded-md sm:w-48" />
            <Skeleton className="h-9 rounded-md bg-foreground/10 sm:w-44" />
          </div>
        </header>

        <section>
          <SectionTitle />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="rounded-2xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="size-7 rounded-lg" />
                </div>
                <Skeleton className="mt-5 h-8 w-20" />
                <div className="mt-4 flex items-center gap-2">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle />
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Panel chart variant={0} />
              <Panel chart variant={1} />
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Panel chart variant={1} />
              <Panel />
            </div>
          </div>
        </section>

        <section>
          <SectionTitle />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel />
            <Panel />
          </div>
        </section>

        <section>
          <SectionTitle />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-32 max-w-full" />
                </div>
                <Skeleton className="size-4 shrink-0 rounded-sm" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
