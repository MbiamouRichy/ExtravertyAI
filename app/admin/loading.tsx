import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";
import { RevenueCardSkeleton } from "@/components/admin/dashboard/revenue";

/** En-tête de carte : titre à gauche, précision à droite. */
function CardHeader({ title = "w-24", note = true }: { title?: string; note?: boolean }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <Skeleton className={`h-4 ${title}`} />
      {note && <Skeleton className="h-3 w-24 max-w-[40%]" />}
    </div>
  );
}

/** Tuiles-onglets (deux colonnes sur téléphone) puis le graphique. */
function ExplorerSkeleton({
  tiles,
  columns,
  chart,
}: {
  tiles: number;
  columns: string;
  chart: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <CardHeader note={false} />
      <div
        className={`grid grid-cols-2 gap-px border-y bg-border [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1 ${columns}`}
      >
        {Array.from({ length: tiles }, (_, index) => (
          <div key={index} className={`px-4 py-3 sm:px-5 ${index === 0 ? "bg-muted/50" : "bg-card"}`}>
            <Skeleton className="h-3 w-16 max-w-full" />
            <Skeleton className="mt-2 h-7 w-20 max-w-full" />
            <Skeleton className="mt-2 h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
      <div className="p-4 sm:p-5">
        <Skeleton className="h-3 w-56 max-w-full" />
        <Skeleton className={`mt-3 w-full ${chart}`} />
      </div>
    </div>
  );
}

// Miroir du tableau de bord : en-tête, croissance, revenu et abonnements, messages et audience.
export default function AdminDashboardLoading() {
  return (
    <PageLoading label="Chargement du tableau de bord…">
      <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 max-w-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-9 w-full rounded-lg sm:w-80" />
        </header>

        <ExplorerSkeleton tiles={4} columns="sm:grid-cols-4" chart="h-[240px]" />

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <RevenueCardSkeleton />
          <ExplorerSkeleton tiles={3} columns="sm:grid-cols-3" chart="h-[200px]" />
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <CardHeader title="w-36" />
            <div className="border-t p-4 sm:p-5">
              <Skeleton className="h-[240px] w-full" />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <CardHeader title="w-20" note={false} />
            <div className="flex gap-5 border-b px-4 py-2.5 sm:px-5">
              {["w-8", "w-10", "w-14", "w-16"].map((width) => (
                <Skeleton key={width} className={`h-4 ${width}`} />
              ))}
            </div>
            <div className="space-y-2 p-4 sm:p-5">
              <Skeleton className="mb-3 h-3 w-32" />
              {[92, 60, 35, 20].map((width) => (
                <Skeleton key={width} className="h-8" style={{ width: `${width}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
