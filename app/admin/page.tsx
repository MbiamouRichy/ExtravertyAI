import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import prisma from "@/lib/prisma";
import { adminMetadata, requireAdminPage } from "@/lib/admin-auth";
import {
  DASHBOARD_RANGES,
  DashboardRangeSchema,
  delta,
  loadDashboard,
  type DashboardRange,
} from "@/lib/admin-dashboard";
import { BarList } from "@/components/admin/dashboard/bar-list";
import { DeltaBadge, Panel, StatTile } from "@/components/admin/dashboard/panel";
import { TrendChart } from "@/components/admin/dashboard/trend-chart";
import { formatValue } from "@/components/admin/dashboard/format";
import {
  RevenuePanel,
  RevenuePanelSkeleton,
  RevenueTile,
  RevenueTileSkeleton,
} from "@/components/admin/dashboard/revenue";
import { cn } from "@/lib/utils";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Vue d’ensemble");
}

const countryName = new Intl.DisplayNames(["fr"], { type: "region" });
const DEVICE_LABEL: Record<string, string> = {
  mobile: "Mobile",
  desktop: "Ordinateur",
  tablet: "Tablette",
};
const PLAN_SERIES = [
  { key: "starter", label: "Starter", color: "var(--chart-3)" },
  { key: "pro", label: "Pro", color: "var(--chart-2)" },
  { key: "business", label: "Business", color: "var(--chart-1)" },
];

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Revérifié ici : le layout ne protège pas les navigations côté client.
  await requireAdminPage();
  const range: DashboardRange = DashboardRangeSchema.parse((await searchParams).range);
  const data = await loadDashboard(prisma, range);
  const { period } = data;
  const previous = DASHBOARD_RANGES[range].previous;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Back-office · Vue d’ensemble
          </p>
          <h1 className="mt-1 text-3xl md:text-4xl">Tableau de bord</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Croissance, audience et abonnements d’ExtravertyAI. Dates en UTC.
          </p>
        </div>
        <nav aria-label="Période" className="inline-flex w-fit rounded-lg border bg-card p-0.5">
          {(Object.keys(DASHBOARD_RANGES) as DashboardRange[]).map((key) => (
            <Link
              key={key}
              href={key === "12m" ? "/admin" : `/admin?range=${key}`}
              aria-current={key === range ? "page" : undefined}
              scroll={false}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                key === range && "bg-muted font-medium text-foreground",
              )}
            >
              {DASHBOARD_RANGES[key].label}
            </Link>
          ))}
        </nav>
      </header>

      <section aria-label="Chiffres clés" className="grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
        <StatTile label="Utilisateurs" value={data.users.total} hint={`+${formatValue(data.users.current)} sur la période`}>
          <DeltaBadge value={delta(data.users.current, data.users.previous)} label={previous} />
        </StatTile>
        <StatTile label="Projets créés" value={data.projects.total} hint={`+${formatValue(data.projects.current)} sur la période`}>
          <DeltaBadge value={delta(data.projects.current, data.projects.previous)} label={previous} />
        </StatTile>
        <Suspense fallback={<RevenueTileSkeleton />}>
          <RevenueTile range={range} />
        </Suspense>
        <StatTile label="Visiteurs" value={data.visitors.current} hint={`${formatValue(data.visitors.online)} en ligne`}>
          <DeltaBadge value={delta(data.visitors.current, data.visitors.previous)} label={previous} />
        </StatTile>
        <StatTile
          label="Désabonnements"
          value={data.flows.churned}
          hint={`${formatValue(data.flows.renewalRate, "percent")} renouvelés`}
        >
          <DeltaBadge value={delta(data.flows.churned, data.flows.previousChurned)} label={previous} inverse />
        </StatTile>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel
          title="Visiteurs"
          description="Visiteurs uniques par jour, sans cookie"
          className="lg:col-span-2"
          headline={
            <p className="mt-2 font-mono text-2xl font-medium tabular-nums">
              {formatValue(data.visitors.current)}
            </p>
          }
        >
          <TrendChart
            data={data.visitors.visitors.map((point, index) => ({
              key: point.key,
              visitors: point.value,
              views: data.visitors.views[index].value,
            }))}
            series={[{ key: "visitors", label: "Visiteurs", color: "var(--chart-1)" }]}
            extraTooltip={[{ key: "views", label: "Pages vues" }]}
            unit={period.unit}
          />
        </Panel>
        <Panel
          title="En ligne"
          description="Visiteurs actifs ces 5 dernières minutes"
          headline={
            <p className="mt-2 flex items-center gap-2 font-mono text-2xl font-medium tabular-nums">
              <span aria-hidden="true" className="size-2 rounded-full bg-foreground motion-safe:animate-pulse" />
              {formatValue(data.visitors.online)}
            </p>
          }
        >
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">Appareils</h3>
          <BarList rows={data.devices} valueLabel="Visiteurs" formatLabel={(label) => DEVICE_LABEL[label] ?? label} />
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Suspense fallback={<RevenuePanelSkeleton />}>
          <RevenuePanel range={range} period={period} />
        </Suspense>
        <Panel
          title="Taux de renouvellement"
          description="Abonnements arrivés à échéance et renouvelés (14 jours de tolérance)"
          headline={
            <p className="mt-2 font-mono text-2xl font-medium tabular-nums">
              {formatValue(data.flows.renewalRate, "percent")}
            </p>
          }
        >
          <TrendChart
            data={data.flows.series.map((point) => ({
              key: point.key,
              renewalRate: point.renewalRate,
              due: point.due,
              renewed: point.renewed,
            }))}
            series={[{ key: "renewalRate", label: "Renouvelés", color: "var(--chart-1)" }]}
            extraTooltip={[
              { key: "renewed", label: "Renouvelés" },
              { key: "due", label: "Échéances" },
            ]}
            unit={period.unit}
            kind="line"
            format="percent"
          />
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel
          title="Projets créés"
          description="Nouveaux projets par période"
          headline={<p className="mt-2 font-mono text-2xl font-medium tabular-nums">{formatValue(data.projects.current)}</p>}
        >
          <TrendChart
            data={data.projects.series.map((point) => ({ key: point.key, projects: point.value }))}
            series={[{ key: "projects", label: "Projets", color: "var(--chart-1)" }]}
            unit={period.unit}
            kind="bar"
          />
        </Panel>
        <Panel
          title="Comptes créés pour 100 visiteurs"
          description="Inscriptions rapportées aux visiteurs de la même période"
          headline={
            <p className="mt-2 font-mono text-2xl font-medium tabular-nums">
              {formatValue(data.visitors.current ? data.users.current / data.visitors.current : null, "percent")}
            </p>
          }
        >
          <TrendChart
            data={data.conversion.map((point) => ({ ...point }))}
            series={[{ key: "rate", label: "Conversion", color: "var(--chart-1)" }]}
            extraTooltip={[
              { key: "signups", label: "Comptes créés" },
              { key: "visitors", label: "Visiteurs" },
            ]}
            unit={period.unit}
            kind="line"
            format="percent"
          />
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel
          title="Messages moyens par projet"
          description="Par offre actuelle du projet, projets actifs sur la période"
        >
          <TrendChart data={data.messages} series={PLAN_SERIES} unit={period.unit} kind="line" />
        </Panel>
        <Panel
          title="Désabonnements"
          description="Abonnements non renouvelés à l’échéance"
          headline={<p className="mt-2 font-mono text-2xl font-medium tabular-nums">{formatValue(data.flows.churned)}</p>}
        >
          <TrendChart
            data={data.flows.series.map((point) => ({
              key: point.key,
              churned: point.churned,
              due: point.due,
            }))}
            series={[{ key: "churned", label: "Désabonnements", color: "var(--chart-1)" }]}
            extraTooltip={[{ key: "due", label: "Échéances" }]}
            unit={period.unit}
            kind="bar"
          />
        </Panel>
      </div>

      <Panel
        title="Essais convertis"
        description="Essais terminés sur la période, suivis d’un premier paiement"
        headline={
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">
            {formatValue(sumRate(data.flows.series), "percent")}
          </p>
        }
      >
        <TrendChart
          data={data.flows.series.map((point) => ({
            key: point.key,
            converted: point.converted,
            trials: point.trials,
          }))}
          series={[{ key: "converted", label: "Essais convertis", color: "var(--chart-1)" }]}
          extraTooltip={[{ key: "trials", label: "Essais terminés" }]}
          unit={period.unit}
          kind="bar"
          height={200}
        />
      </Panel>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="Top pays" description="Part des visiteurs">
          <BarList
            rows={data.countries}
            valueLabel="Visiteurs"
            formatLabel={(code) => (/^[A-Z]{2}$/.test(code) ? (countryName.of(code) ?? code) : code)}
          />
        </Panel>
        <Panel title="Top pages" description="Part des pages vues">
          <BarList rows={data.pages} valueLabel="Pages vues" mono />
        </Panel>
        <Panel title="Navigateurs" description="Part des visiteurs">
          <BarList rows={data.browsers} valueLabel="Visiteurs" />
        </Panel>
        <Panel title="Sites référents" description="D’où viennent les visiteurs">
          <BarList rows={data.referrers} valueLabel="Visiteurs" mono />
        </Panel>
      </div>
    </div>
  );
}

function sumRate(series: { trials: number; converted: number }[]) {
  const trials = series.reduce((sum, point) => sum + point.trials, 0);
  return trials ? series.reduce((sum, point) => sum + point.converted, 0) / trials : null;
}
