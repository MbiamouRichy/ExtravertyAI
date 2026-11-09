import { loadRevenue } from "@/lib/admin-revenue";
import { delta, type DashboardPeriod, type DashboardRange } from "@/lib/admin-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardCard, MetricFigure } from "./card";
import { DeltaBadge } from "./panel";
import { TrendChart } from "./trend-chart";
import { formatValue } from "./format";

function sourceNote(source: "payments" | "estimate", others: string[]) {
  const base = source === "payments" ? "Paiements encaissés" : "Estimation, prestataire injoignable";
  return others.length ? `${base} · hors ${others.join(", ")}` : base;
}

/** Revenu : chargé à part, le prestataire de paiement peut être lent. */
export async function RevenueCard({
  range,
  period,
}: {
  range: DashboardRange;
  period: DashboardPeriod;
}) {
  const revenue = await loadRevenue(range);
  return (
    <DashboardCard id="revenue" title="Revenu" note={sourceNote(revenue.source, revenue.otherCurrencies)}>
      {/* Même gabarit qu’une tuile d’onglet, pour aligner les cartes voisines. */}
      <div className="border-y px-4 py-3 sm:px-5">
        <MetricFigure
          label={revenue.source === "payments" ? "Encaissé" : "Estimé"}
          value={formatValue(revenue.current, "currency", revenue.currency)}
          footer={<DeltaBadge value={delta(revenue.current, revenue.previous)} label="" />}
        />
      </div>
      <div className="flex-1 p-4 sm:p-5">
        <p className="mb-3 text-xs text-muted-foreground">Montant par période, en {revenue.currency}</p>
        <TrendChart
          data={revenue.series.map((point) => ({ key: point.key, revenue: point.value }))}
          series={[{ key: "revenue", label: "Revenu", color: "var(--chart-1)" }]}
          unit={period.unit}
          kind="area"
          format="currency"
          currency={revenue.currency}
          height={200}
        />
      </div>
    </DashboardCard>
  );
}

export function RevenueCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card" aria-busy="true">
      <p className="sr-only" role="status">Chargement du revenu…</p>
      <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="border-y px-4 py-3 sm:px-5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-7 w-28" />
        <Skeleton className="mt-2 h-5 w-14 rounded-full" />
      </div>
      <div className="p-4 sm:p-5">
        <Skeleton className="h-3 w-40 max-w-full" />
        <Skeleton className="mt-3 h-[200px] w-full" />
      </div>
    </div>
  );
}
