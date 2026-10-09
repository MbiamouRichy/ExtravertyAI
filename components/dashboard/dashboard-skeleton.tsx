import { Skeleton } from "@/components/ui/skeleton";
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-5 rounded-xl border bg-card p-5">
      <Skeleton className="h-5 w-48 max-w-full" />
      <Skeleton className="h-3 w-3/4" />
      {children}
    </div>
  );
}
function Graph() {
  return (
    <div className="flex h-64 items-end gap-3 border-b border-l px-4 sm:h-80">
      {["h-1/3", "h-2/3", "h-1/2", "h-3/4", "h-2/5", "h-4/5", "h-3/5"].map(
        (height, i) => (
          <Skeleton
            key={i}
            className={"min-w-0 flex-1 rounded-b-none " + height}
          />
        ),
      )}
    </div>
  );
}
export function DashboardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Tableau de bord"
      className="mx-auto w-full min-w-0 max-w-(--breakpoint-2xl) p-4 md:p-6"
    >
      <p role="status" className="sr-only">
        Chargement du tableau de bord…
      </p>
      <div
        aria-hidden="true"
        className="space-y-5 motion-reduce:**:data-[slot=skeleton]:animate-none"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-3 rounded-xl border bg-card p-5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Panel>
            <Graph />
          </Panel>
          <Panel>
            <Graph />
          </Panel>
        </div>
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel>
            <Graph />
          </Panel>
          <Panel>
            <Skeleton className="mx-auto size-44 rounded-full" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex justify-between gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </Panel>
        </div>
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-6 border-t py-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </Panel>
          <Panel>
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
            <Skeleton className="mx-auto h-8 w-32" />
          </Panel>
        </div>
        <Panel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Skeleton className="size-8 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
