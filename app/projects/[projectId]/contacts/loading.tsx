import { Skeleton } from "@/components/ui/skeleton";

export default function ContactsLoading() {
  return (
    <main
      className="mx-auto w-full min-w-0 max-w-7xl px-4 py-7 sm:px-8 lg:py-10"
      aria-busy="true"
    >
      <p role="status" className="sr-only">
        Chargement des contacts…
      </p>
      <div
        aria-hidden="true"
        className="space-y-7 motion-reduce:**:data-[slot=skeleton]:animate-none"
      >
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Skeleton className="mb-2 h-4 w-56 max-w-full" />
            <Skeleton className="h-9 w-80 max-w-full" />
            <Skeleton className="mt-3 h-5 w-full max-w-lg" />
          </div>
          <Skeleton className="h-9 w-full shrink-0 sm:w-52" />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="min-w-0 rounded-2xl border bg-card p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-36 max-w-full" />
                <Skeleton className="size-5 shrink-0" />
              </div>
              <Skeleton className="h-9 w-12" />
              <Skeleton className="mt-2 h-4 w-52 max-w-full" />
            </div>
          ))}
        </div>
        <div className="min-w-0 overflow-hidden rounded-2xl border bg-card">
          <div className="space-y-4 border-b p-4 sm:p-5">
            <Skeleton className="h-9 w-full sm:w-56" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex max-w-full flex-wrap gap-2">
                {["w-16", "w-28", "w-32"].map((width) => (
                  <Skeleton
                    key={width}
                    className={`h-10 rounded-full ${width}`}
                  />
                ))}
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-9 w-full max-w-sm" />
              <Skeleton className="size-9 shrink-0 sm:w-28" />
            </div>
            <div className="overflow-hidden rounded-xl border">
              <div className="hidden grid-cols-5 gap-6 border-b bg-muted/30 px-4 py-3 md:grid">
                {[0, 1, 2, 3, 4].map((index) => (
                  <Skeleton key={index} className="h-4 w-20 max-w-full" />
                ))}
              </div>
              <div className="divide-y">
                {[0, 1, 2, 3, 4].map((index) => (
                  <div
                    key={index}
                    className="flex min-w-0 flex-col items-stretch gap-3 px-4 py-4 md:grid md:items-center md:grid-cols-5 md:gap-6"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Skeleton className="size-8 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-28 max-w-full" />
                        <Skeleton className="h-3 w-20 max-w-full" />
                      </div>
                    </div>
                    <Skeleton className="hidden h-4 w-full max-w-28 md:block" />
                    <Skeleton className="hidden h-8 w-24 max-w-full rounded-full md:block" />
                    <Skeleton className="hidden h-4 w-20 max-w-full md:block" />
                    <Skeleton className="h-9 w-full shrink-0 md:ml-auto md:max-w-28" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-4 w-28" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="size-9" />
                <Skeleton className="size-9" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
