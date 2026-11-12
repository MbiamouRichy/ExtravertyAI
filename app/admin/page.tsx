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
import { AudienceCard } from "@/components/admin/dashboard/audience";
import { DashboardCard } from "@/components/admin/dashboard/card";
import { MetricExplorer, type ExplorerMetric } from "@/components/admin/dashboard/metric-explorer";
import { TrendChart } from "@/components/admin/dashboard/trend-chart";
import { formatValue } from "@/components/admin/dashboard/format";
import { RevenueCard, RevenueCardSkeleton } from "@/components/admin/dashboard/revenue";
import { cn } from "@/lib/utils";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Vue d’ensemble");
}

/** Libellés courts du sélecteur sur téléphone : quatre cases qui tiennent sans défiler. */
const RANGE_SHORT: Record<DashboardRange, string> = {
  "30d": "30 j",
  "90d": "90 j",
  "12m": "12 m",
  "24m": "24 m",
};
const PLAN_SERIES = [
  { key: "starter", label: "Starter", color: "var(--chart-3)" },
  { key: "pro", label: "Pro", color: "var(--chart-2)" },
  { key: "business", label: "Business", color: "var(--chart-1)" },
];

const ratio = (part: number, whole: number) => (whole ? part / whole : null);
const sum = <T,>(rows: T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Revérifié ici : le layout ne protège pas les navigations côté client.
  await requireAdminPage();
  const range: DashboardRange = DashboardRangeSchema.parse((await searchParams).range);
  const data = await loadDashboard(prisma, range);
  const { period, users, projects, visitors, flows } = data;

  const conversion = ratio(users.current, visitors.current);
  const previousConversion = ratio(users.previous, visitors.previous);
  const growth: ExplorerMetric[] = [
    {
      id: "visitors",
      label: "Visiteurs",
      value: formatValue(visitors.current),
      delta: delta(visitors.current, visitors.previous),
      description: `Visiteurs uniques par jour, sans cookie · ${formatValue(visitors.online)} en ligne`,
      chart: {
        data: visitors.visitors.map((point, index) => ({
          key: point.key,
          visitors: point.value,
          views: visitors.views[index].value,
        })),
        series: [{ key: "visitors", label: "Visiteurs", color: "var(--chart-1)" }],
        extraTooltip: [{ key: "views", label: "Pages vues" }],
      },
    },
    {
      id: "signups",
      label: "Inscriptions",
      value: formatValue(users.current),
      delta: delta(users.current, users.previous),
      description: `Comptes créés · ${formatValue(users.total)} au total`,
      chart: {
        data: users.series.map((point) => ({ key: point.key, signups: point.value })),
        series: [{ key: "signups", label: "Inscriptions", color: "var(--chart-1)" }],
        kind: "bar",
      },
    },
    {
      id: "projects",
      label: "Projets créés",
      value: formatValue(projects.current),
      delta: delta(projects.current, projects.previous),
      description: `Nouveaux projets · ${formatValue(projects.total)} au total`,
      chart: {
        data: projects.series.map((point) => ({ key: point.key, projects: point.value })),
        series: [{ key: "projects", label: "Projets", color: "var(--chart-1)" }],
        kind: "bar",
      },
    },
    {
      id: "conversion",
      label: "Conversion",
      value: formatValue(conversion, "percent"),
      delta: conversion === null || previousConversion === null ? undefined : delta(conversion, previousConversion),
      hint: "Inscriptions / visiteurs",
      description: "Comptes créés pour 100 visiteurs de la même période",
      chart: {
        data: data.conversion.map((point) => ({ ...point })),
        series: [{ key: "rate", label: "Conversion", color: "var(--chart-1)" }],
        kind: "line",
        format: "percent",
        extraTooltip: [
          { key: "signups", label: "Inscriptions" },
          { key: "visitors", label: "Visiteurs" },
        ],
      },
    },
  ];

  const due = sum(flows.series, (point) => point.due);
  const renewed = sum(flows.series, (point) => point.renewed);
  const trials = sum(flows.series, (point) => point.trials);
  const converted = sum(flows.series, (point) => point.converted);
  const subscriptions: ExplorerMetric[] = [
    {
      id: "renewal",
      label: "Renouvellement",
      value: formatValue(flows.renewalRate, "percent"),
      hint: `${formatValue(renewed)} / ${formatValue(due)} échéances`,
      description: "Abonnements arrivés à échéance et renouvelés, 14 jours de tolérance",
      chart: {
        data: flows.series.map((point) => ({
          key: point.key,
          renewalRate: point.renewalRate,
          renewed: point.renewed,
          due: point.due,
        })),
        series: [{ key: "renewalRate", label: "Renouvelés", color: "var(--chart-1)" }],
        kind: "line",
        format: "percent",
        extraTooltip: [
          { key: "renewed", label: "Renouvelés" },
          { key: "due", label: "Échéances" },
        ],
      },
    },
    {
      id: "churn",
      label: "Désabonnements",
      value: formatValue(flows.churned),
      delta: delta(flows.churned, flows.previousChurned),
      inverse: true,
      description: "Abonnements non renouvelés à l’échéance",
      chart: {
        data: flows.series.map((point) => ({ key: point.key, churned: point.churned, due: point.due })),
        series: [{ key: "churned", label: "Désabonnements", color: "var(--chart-1)" }],
        kind: "bar",
        extraTooltip: [{ key: "due", label: "Échéances" }],
      },
    },
    {
      id: "trials",
      label: "Essais convertis",
      value: formatValue(ratio(converted, trials), "percent"),
      hint: `${formatValue(converted)} / ${formatValue(trials)} essais`,
      description: "Essais terminés sur la période, suivis d’un premier paiement",
      chart: {
        data: flows.series.map((point) => ({ key: point.key, converted: point.converted, trials: point.trials })),
        series: [{ key: "converted", label: "Essais convertis", color: "var(--chart-1)" }],
        kind: "bar",
        extraTooltip: [{ key: "trials", label: "Essais terminés" }],
      },
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Vue d’ensemble</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Variations {DASHBOARD_RANGES[range].previous} · dates en UTC
          </p>
        </div>
        <nav
          aria-label="Période"
          className="grid w-full grid-cols-4 rounded-lg border bg-card p-0.5 sm:w-auto"
        >
          {(Object.keys(DASHBOARD_RANGES) as DashboardRange[]).map((key) => (
            <Link
              key={key}
              href={key === "12m" ? "/admin" : `/admin?range=${key}`}
              aria-current={key === range ? "page" : undefined}
              aria-label={DASHBOARD_RANGES[key].label}
              scroll={false}
              className={cn(
                "rounded-md px-2 py-1.5 text-center text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:px-3",
                key === range && "bg-muted font-medium text-foreground",
              )}
            >
              <span className="sm:hidden">{RANGE_SHORT[key]}</span>
              <span className="hidden sm:inline">{DASHBOARD_RANGES[key].label}</span>
            </Link>
          ))}
        </nav>
      </header>

      <MetricExplorer
        id="growth"
        title="Croissance"
        metrics={growth}
        unit={period.unit}
        columns="sm:grid-cols-4"
        height={240}
      />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Suspense fallback={<RevenueCardSkeleton />}>
          <RevenueCard range={range} period={period} />
        </Suspense>
        <MetricExplorer
          id="subscriptions"
          title="Abonnements"
          metrics={subscriptions}
          unit={period.unit}
          columns="sm:grid-cols-3"
          height={200}
        />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <DashboardCard id="messages" title="Messages par projet" note="Moyenne par offre, projets actifs">
          <div className="flex-1 border-t p-4 sm:p-5">
            <TrendChart data={data.messages} series={PLAN_SERIES} unit={period.unit} kind="line" height={240} />
          </div>
        </DashboardCard>
        <AudienceCard
          id="audience"
          countries={data.countries}
          pages={data.pages}
          referrers={data.referrers}
          devices={data.devices}
          browsers={data.browsers}
        />
      </div>
    </div>
  );
}
