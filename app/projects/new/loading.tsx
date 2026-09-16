import { Skeleton } from "@/components/ui/skeleton";

const skeletonClassName = "motion-reduce:animate-none";

export default function LoadingNewProject() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Chargement de la création de projet"
      className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8"
    >
      <span className="sr-only">
        Chargement du formulaire de création de projet…
      </span>

      <div aria-hidden="true">
        <div className="mb-7 flex h-11 items-center">
          <Skeleton className={`h-4 w-28 ${skeletonClassName}`} />
        </div>

        <div className="mb-8 max-w-2xl space-y-4 sm:mb-10">
          <Skeleton
            className={`h-8 w-64 max-w-full rounded-full ${skeletonClassName}`}
          />
          <Skeleton className={`h-10 w-full max-w-xl ${skeletonClassName}`} />
          <div className="space-y-2">
            <Skeleton className={`h-5 w-full ${skeletonClassName}`} />
            <Skeleton className={`h-5 w-4/5 ${skeletonClassName}`} />
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          <div className="min-w-0 space-y-6">
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <SectionHeader />

              <div className="space-y-6 p-5 sm:p-6">
                <Skeleton
                  className={`h-3 w-44 max-w-full ${skeletonClassName}`}
                />

                {[0, 1].map((field) => (
                  <div key={field} className="space-y-2">
                    <Skeleton className={`h-4 w-36 ${skeletonClassName}`} />
                    <Skeleton
                      className={`h-12 w-full rounded-xl ${skeletonClassName}`}
                    />
                    <Skeleton className={`h-3 w-4/5 ${skeletonClassName}`} />
                  </div>
                ))}

                <Skeleton
                  className={`h-20 w-full rounded-xl ${skeletonClassName}`}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <SectionHeader />

              <div className="p-5 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[0, 1, 2].map((plan) => (
                    <Skeleton
                      key={plan}
                      className={`h-56 w-full rounded-xl ${skeletonClassName}`}
                    />
                  ))}
                </div>

                <Skeleton className={`mt-4 h-8 w-full ${skeletonClassName}`} />
              </div>
            </div>

            <Skeleton className={`h-14 w-full ${skeletonClassName}`} />
          </div>

          <div className="min-w-0 lg:sticky lg:top-8">
            <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm">
              <div className="space-y-4 border-b border-border bg-primary/5 p-5 sm:p-6">
                <div className="flex justify-between gap-4">
                  <Skeleton className={`h-5 w-24 ${skeletonClassName}`} />
                  <Skeleton
                    className={`h-6 w-28 rounded-full ${skeletonClassName}`}
                  />
                </div>
                <Skeleton className={`h-4 w-3/4 ${skeletonClassName}`} />
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex justify-between gap-4">
                    <Skeleton className={`h-4 w-28 ${skeletonClassName}`} />
                    <Skeleton className={`h-4 w-24 ${skeletonClassName}`} />
                  </div>
                ))}

                <div className="space-y-4 border-t border-border pt-5">
                  <Skeleton className={`h-9 w-full ${skeletonClassName}`} />
                  <Skeleton className={`h-14 w-full ${skeletonClassName}`} />
                </div>

                <Skeleton
                  className={`h-12 w-full rounded-xl ${skeletonClassName}`}
                />
                <Skeleton
                  className={`mx-auto h-3 w-44 max-w-full ${skeletonClassName}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader() {
  return (
    <div className="flex items-start gap-3 border-b border-border p-5 sm:p-6">
      <Skeleton className={`size-9 shrink-0 rounded-xl ${skeletonClassName}`} />

      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className={`h-5 w-3/5 ${skeletonClassName}`} />
        <Skeleton className={`h-4 w-4/5 ${skeletonClassName}`} />
      </div>
    </div>
  );
}
