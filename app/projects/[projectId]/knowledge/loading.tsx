import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";

// Miroir de la base de connaissances : en-tête, jauges, onglets et liste.
export default function KnowledgeLoading() {
  return (
    <PageLoading
      label="Chargement de la base de connaissances…"
      className="mx-auto w-full max-w-6xl p-4 sm:p-6 xl:p-8"
    >
      <div className="space-y-6">
        <header className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-80 max-w-full" />
          <Skeleton className="h-4 w-xl max-w-full" />
        </header>
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-9 w-96 max-w-full" />
        <div className="space-y-px overflow-hidden rounded-2xl border">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="space-y-2 p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </PageLoading>
  );
}
