import { loadRevenue } from "@/lib/admin-revenue";
import { delta, type DashboardPeriod, type DashboardRange, DASHBOARD_RANGES } from "@/lib/admin-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { DeltaBadge, Panel, StatTile } from "./panel";
import { TrendChart } from "./trend-chart";
import { formatValue } from "./format";

function sourceNote(source: "stripe" | "estimate", others: string[]) {
  const base =
    source === "stripe"
      ? "Factures payées dans Stripe"
      : "Estimé : mois payés × prix catalogue (Stripe injoignable)";
  return others.length ? `${base} · hors ${others.join(", ")}` : base;
}

/** Tuile et graphique du revenu : chargés à part, Stripe peut être lent. */
export async function RevenueTile({ range }: { range: DashboardRange }) {
  const revenue = await loadRevenue(range);
  return (
    <StatTile
      label="Revenu encaissé"
      value={revenue.current}
      format="currency"
      currency={revenue.currency}
      hint={revenue.source === "stripe" ? "Factures Stripe payées" : "Estimation"}
    >
      <DeltaBadge value={delta(revenue.current, revenue.previous)} label={DASHBOARD_RANGES[range].previous} />
    </StatTile>
  );
}

export async function RevenuePanel({ range, period }: { range: DashboardRange; period: DashboardPeriod }) {
  const revenue = await loadRevenue(range);
  return (
    <Panel
      title="Revenu"
      description={sourceNote(revenue.source, revenue.otherCurrencies)}
      className="lg:col-span-2"
      headline={
        <p className="mt-2 font-mono text-2xl font-medium tabular-nums">
          {formatValue(revenue.current, "currency", revenue.currency)}
        </p>
      }
      aside={<DeltaBadge value={delta(revenue.current, revenue.previous)} label="" />}
    >
      <TrendChart
        data={revenue.series.map((point) => ({ key: point.key, revenue: point.value }))}
        series={[{ key: "revenue", label: "Revenu", color: "var(--chart-1)" }]}
        unit={period.unit}
        kind="area"
        format="currency"
        currency={revenue.currency}
      />
    </Panel>
  );
}

export function RevenueTileSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-4" aria-busy="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-32" />
      <Skeleton className="mt-4 h-4 w-40" />
    </div>
  );
}

export function RevenuePanelSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-5 lg:col-span-2" aria-busy="true">
      <p className="sr-only" role="status">Chargement du revenu…</p>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-3 h-7 w-36" />
      <Skeleton className="mt-6 h-56 w-full" />
    </div>
  );
}
