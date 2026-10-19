import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir des intégrations : en-tête, Google Sheets, webhooks et journal.
export default function IntegrationsLoading() {
  return (
    <PageLoading
      label="Chargement des intégrations…"
      className="mx-auto w-full max-w-6xl p-4 sm:p-6 xl:p-8"
    >
      <div className="space-y-6">
        <header className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-xl max-w-full" />
        </header>
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="space-y-px overflow-hidden rounded-2xl border">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="space-y-2 p-4">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </PageLoading>
  );
}
