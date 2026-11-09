"use client";

import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { DashboardCard, MetricFigure } from "./card";
import { DeltaBadge } from "./panel";
import { TrendChart, type TrendSeries } from "./trend-chart";
import type { ValueFormat } from "./format";

type Point = { key: string } & Record<string, number | string | null>;

export type ExplorerMetric = {
  id: string;
  label: string;
  /** Déjà formatée côté serveur. */
  value: string;
  /** Variation vs période précédente ; sinon `hint` s’affiche. */
  delta?: number | null;
  /** Une baisse est une bonne nouvelle (désabonnements). */
  inverse?: boolean;
  hint?: string;
  /** Ce que montre le graphique, en une phrase. */
  description: string;
  chart: {
    data: Point[];
    series: TrendSeries[];
    kind?: "area" | "bar" | "line";
    format?: ValueFormat;
    extraTooltip?: { key: string; label: string; format?: ValueFormat }[];
  };
};

/**
 * Chiffres clés qui servent d’onglets : un clic (ou les flèches du clavier)
 * affiche la courbe du chiffre choisi. Téléphone : deux colonnes ; un chiffre
 * seul sur sa ligne prend toute la largeur.
 */
export function MetricExplorer({
  id,
  title,
  note,
  metrics,
  unit,
  columns,
  height = 220,
  className,
}: {
  id: string;
  title: string;
  note?: string;
  metrics: ExplorerMetric[];
  unit: "day" | "month";
  /** Colonnes dès sm (par défaut : une par chiffre). */
  columns: "sm:grid-cols-3" | "sm:grid-cols-4";
  height?: number;
  className?: string;
}) {
  return (
    <DashboardCard id={id} title={title} note={note} className={className}>
      <TabsPrimitive.Root defaultValue={metrics[0]?.id} className="flex flex-1 flex-col">
        <TabsPrimitive.List
          aria-labelledby={`${id}-title`}
          className={cn(
            "grid grid-cols-2 gap-px border-y bg-border [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1",
            columns,
          )}
        >
          {metrics.map((metric) => (
            <TabsPrimitive.Trigger
              key={metric.id}
              value={metric.id}
              className="group relative min-w-0 cursor-pointer bg-card px-4 py-3 text-left transition-colors outline-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-transparent hover:bg-muted/40 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[state=active]:bg-muted/50 data-[state=active]:after:bg-foreground sm:px-5"
            >
              <MetricFigure
                label={metric.label}
                value={metric.value}
                footer={
                  metric.delta !== undefined ? (
                    <DeltaBadge value={metric.delta} label="" inverse={metric.inverse} />
                  ) : (
                    <span className="truncate">{metric.hint}</span>
                  )
                }
              />
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        {metrics.map((metric) => (
          <TabsPrimitive.Content
            key={metric.id}
            value={metric.id}
            className="flex-1 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:p-5"
          >
            <p className="mb-3 text-xs text-muted-foreground">{metric.description}</p>
            <TrendChart
              data={metric.chart.data}
              series={metric.chart.series}
              kind={metric.chart.kind}
              format={metric.chart.format}
              extraTooltip={metric.chart.extraTooltip}
              unit={unit}
              height={height}
            />
          </TabsPrimitive.Content>
        ))}
      </TabsPrimitive.Root>
    </DashboardCard>
  );
}
