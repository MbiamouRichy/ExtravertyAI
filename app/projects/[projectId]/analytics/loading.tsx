import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de la page Statistiques, section par section.

function SectionTitle({ width = "w-44" }: { width?: string }) {
  return <Skeleton className={`h-4 ${width}`} />;
}

function ChartCard({
  children,
  className = "",
  aside,
}: {
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <div className={`min-w-0 rounded-xl border bg-card ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 pb-3 sm:px-5">
        <div className="min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-44 max-w-full" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      <div className="px-4 pb-4 sm:px-5">{children}</div>
    </div>
  );
}

/** Grille et barres : silhouette des graphiques d’activité. */
function Bars({ height = "h-56" }: { height?: string }) {
  const bars = [14, 32, 20, 46, 28, 60, 38, 24, 52, 34, 68, 26, 44, 18];
  return (
    <div className={`flex items-end gap-1.5 sm:gap-2 ${height}`}>
      {bars.map((value, index) => (
        <Skeleton
          key={index}
          className="flex-1 rounded-b-none rounded-t-sm"
          style={{ height: `${value}%` }}
        />
      ))}
    </div>
  );
}

/** Courbe de points : silhouette du temps de réponse IA. */
function Dots() {
  const points = [52, 38, 60, 44, 30, 48, 36];
  return (
    <div className="relative h-56">
      <div className="absolute inset-0 flex flex-col justify-between">
        {[0, 1, 2, 3].map((line) => (
          <div key={line} className="border-t border-dashed" />
        ))}
      </div>
      <div className="relative flex h-full items-end justify-between px-2">
        {points.map((value, index) => (
          <div key={index} className="flex h-full items-end" style={{ paddingBottom: `${value}%` }}>
            <Skeleton className="size-2.5 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Rows({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y rounded-xl border">
      {Array.from({ length: count }, (_, row) => (
        <div key={row} className="flex items-center justify-between gap-4 px-3 py-3">
          <Skeleton className="h-3.5 w-32 max-w-[60%]" />
          <Skeleton className="h-3.5 w-12" />
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsLoading() {
  return (
    <PageLoading label="Chargement des statistiques…" className="@container min-w-0">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 sm:p-6 lg:p-8">
        {/* En-tête : titre, export, choix de la période */}
        <header className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-9 w-20 rounded-md sm:w-36" />
          </div>
          <div className="flex flex-col gap-2 @3xl:flex-row @3xl:items-center @3xl:justify-between">
            <Skeleton className="h-10 w-full rounded-lg @3xl:w-96" />
            <Skeleton className="h-3.5 w-56 max-w-full" />
          </div>
        </header>

        {/* Indicateurs clés */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border @3xl:grid-cols-3 @6xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="space-y-2 bg-card p-3 sm:p-4">
              <Skeleton className="h-3 w-24 max-w-full" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          ))}
        </div>

        {/* Activité & acquisition */}
        <section className="space-y-3">
          <SectionTitle />
          <div className="grid min-w-0 gap-4 @3xl:grid-cols-2 @5xl:grid-cols-6">
            <ChartCard className="@3xl:col-span-2 @5xl:col-span-4">
              <Bars height="h-56 sm:h-64" />
            </ChartCard>
            <ChartCard className="@3xl:col-span-2">
              <div className="flex flex-col items-center gap-4">
                <Skeleton className="relative size-44 rounded-full">
                  <span className="absolute inset-[18%] rounded-full bg-card" />
                </Skeleton>
                <div className="w-full">
                  <Rows count={3} />
                </div>
              </div>
            </ChartCard>
            <ChartCard className="@5xl:col-span-3">
              <Bars />
            </ChartCard>
            <ChartCard className="@5xl:col-span-3">
              <Bars />
            </ChartCard>
          </div>
        </section>

        {/* IA & prospects : qui répond, Instinct IA, temps de réponse, réponses évitées, heures */}
        <section className="space-y-3">
          <SectionTitle width="w-32" />
          <div className="grid min-w-0 gap-4 @3xl:grid-cols-2">
            <ChartCard>
              <Rows count={3} />
            </ChartCard>
            <ChartCard>
              <div className="space-y-2">
                {[100, 70, 45, 25].map((width, index) => (
                  <Skeleton
                    key={index}
                    className="h-9 rounded-lg"
                    style={{ width: `${width}%` }}
                  />
                ))}
              </div>
            </ChartCard>
            <ChartCard>
              <Dots />
            </ChartCard>
            <ChartCard>
              <Skeleton className="h-10 w-24" />
              <Skeleton className="mt-4 h-3 w-full max-w-sm" />
            </ChartCard>
            <ChartCard className="@3xl:col-span-2">
              <div className="grid grid-cols-12 gap-1">
                {Array.from({ length: 84 }, (_, cell) => (
                  <Skeleton key={cell} className="h-6 rounded-sm sm:h-7" />
                ))}
              </div>
            </ChartCard>
          </div>
        </section>

        {/* Livraison & contacts */}
        <section className="space-y-3">
          <SectionTitle width="w-40" />
          <div className="grid min-w-0 gap-4">
            <ChartCard>
              <Rows />
            </ChartCard>
            <ChartCard aside={<Skeleton className="h-8 w-36" />}>
              {/* Même requête de conteneur que la carte réelle : fiches sur
                  carte étroite, tableau dès que la carte est assez large. */}
              <div className="@container/top-contacts space-y-3">
                <Skeleton className="h-9 w-full @md/top-contacts:max-w-xs" />
                <ul className="-mx-4 divide-y border-t sm:-mx-5 @4xl/top-contacts:hidden">
                  {Array.from({ length: 4 }, (_, row) => (
                    <li key={row} className="space-y-3 px-4 py-3 sm:px-5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <Skeleton className="h-3.5 w-32 max-w-full" />
                          <Skeleton className="h-3 w-20 max-w-full" />
                        </div>
                        <Skeleton className="h-8 w-24 shrink-0 @max-xs/top-contacts:size-9" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Skeleton className="h-9 rounded-lg" />
                        <Skeleton className="h-9 rounded-lg" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Skeleton className="h-5 w-24 shrink-0" />
                        <Skeleton className="h-5 w-20 shrink-0" />
                        <Skeleton className="ml-auto h-3 w-16 shrink-0" />
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-hidden rounded-xl border @4xl/top-contacts:block">
                  {Array.from({ length: 6 }, (_, row) => (
                    <div
                      key={row}
                      className="grid grid-cols-[2rem_minmax(0,1.8fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1fr)_6.5rem] items-center gap-4 border-b px-2 last:border-b-0 first:h-10 not-first:py-2.5 @5xl/top-contacts:grid-cols-[2rem_minmax(0,1.8fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_6.5rem]"
                    >
                      {row === 0 ? (
                        <>
                          <span />
                          <Skeleton className="h-3 w-14 max-w-full" />
                          <Skeleton className="ml-auto h-3 w-12 max-w-full" />
                          <Skeleton className="ml-auto h-3 w-14 max-w-full" />
                          <Skeleton className="hidden h-3 w-24 max-w-full @5xl/top-contacts:block" />
                          <Skeleton className="h-3 w-16 max-w-full" />
                          <span />
                        </>
                      ) : (
                        <>
                          <Skeleton className="h-3 w-4" />
                          <div className="flex min-w-0 items-center gap-3">
                            <Skeleton className="size-8 shrink-0 rounded-full" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <Skeleton className="h-3.5 w-32 max-w-full" />
                              <Skeleton className="h-3 w-20 max-w-full" />
                            </div>
                          </div>
                          <Skeleton className="ml-auto h-3.5 w-8 max-w-full" />
                          <Skeleton className="ml-auto h-3.5 w-8 max-w-full" />
                          <Skeleton className="hidden h-3 w-20 max-w-full @5xl/top-contacts:block" />
                          <Skeleton className="h-5 w-24 max-w-full" />
                          <Skeleton className="ml-auto h-8 w-24 max-w-full" />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>
          </div>
        </section>
      </div>
    </PageLoading>
  );
}
