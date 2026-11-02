"use client";
import { Pie, PieChart } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { visibleMessageSources } from "@/lib/message-sources";
import { AnalyticsCard } from "./analytics-card";
import { ChartEmptyState } from "./chart-empty-state";
export type MessageSourceKey = "android" | "ios" | "ai" | "unknown";
export type SourceDatum = {
  source: MessageSourceKey;
  count: number;
  fill: string;
};
interface Props {
  data: SourceDatum[];
  totalMessages: number;
  otherSources?: { source: string; count: number }[];
  trendPercentage?: number;
  error?: string;
  className?: string;
}
export function SourceMessageChart({
  data,
  totalMessages,
  otherSources = [],
  trendPercentage = 0,
  error,
  className,
}: Props) {
  const rows = visibleMessageSources(data, otherSources);
  const config: ChartConfig = Object.fromEntries(
    rows.map((row) => [row.key, { label: row.label, color: row.fill }]),
  );
  return (
    <AnalyticsCard
      title="Sources des messages"
      description={
        error
          ? "Données indisponibles"
          : `${totalMessages.toLocaleString("fr-FR")} message${totalMessages > 1 ? "s" : ""} sur 7 jours`
      }
      className={className}
      aside={
        !error &&
        trendPercentage !== 0 && (
          <Delta value={trendPercentage} className="text-xs font-medium">
            <DeltaIcon variant="trend" />
            <DeltaValue suffix="%" />
          </Delta>
        )
      }
    >
      {error ? (
        <p role="alert" className="py-8 text-sm text-muted-foreground">
          {error}
        </p>
      ) : rows.length && totalMessages > 0 ? (
        <div className="space-y-3">
          <ChartContainer
            config={config}
            className="mx-auto aspect-square w-full max-w-40"
          >
            <PieChart accessibilityLayer>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={rows}
                dataKey="count"
                nameKey="key"
                innerRadius="66%"
                outerRadius="100%"
                paddingAngle={2}
                cornerRadius={4}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </PieChart>
          </ChartContainer>
          <ul aria-label="Répartition des sources" className="divide-y">
            {rows.map((row) => (
              <li
                key={row.source}
                className="flex items-center justify-between gap-4 py-2 text-sm last:pb-0"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: row.fill }}
                  />
                  <span className="wrap-anywhere">{row.label}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                  <strong className="font-medium">
                    {row.count.toLocaleString("fr-FR")}
                  </strong>
                  <span className="min-w-12 text-right text-xs text-muted-foreground">
                    {((row.count / totalMessages) * 100).toLocaleString(
                      "fr-FR",
                      { maximumFractionDigits: 1 },
                    )}{" "}
                    %
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ChartEmptyState
          icon={PieChartIcon}
          title="Aucun message"
          description="Aucun message sur cette période."
        />
      )}
    </AnalyticsCard>
  );
}
