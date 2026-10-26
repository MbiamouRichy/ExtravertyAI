import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

export default function ReportsLoading() {
  return (
    <PageLoading
      label="Chargement des rapports…"
      className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10"
    >
      <div className="space-y-14">
        <header className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </header>

        {/* Verdict */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full max-w-3xl" />
          <Skeleton className="h-8 w-2/3 max-w-xl" />
        </div>

        {/* Actions */}
        <div className="divide-y border-y">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="flex items-start justify-between gap-6 py-5"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-full max-w-md" />
                <Skeleton className="h-4 w-full max-w-lg" />
              </div>
              <Skeleton className="h-8 w-36 shrink-0" />
            </div>
          ))}
        </div>

        {/* Indicateurs */}
        <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="space-y-3 bg-background p-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      </div>
    </PageLoading>
  );
}
