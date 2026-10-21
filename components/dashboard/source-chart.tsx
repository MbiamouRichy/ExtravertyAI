"use client";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { Pie, PieChart } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { visibleMessageSources } from "@/lib/message-sources";
import { ChartEmptyState } from "./chart-empty-state";
export type MessageSourceKey = "android" | "ios" | "ai" | "unknown";
export type SourceDatum = {
  source: MessageSourceKey;
  count: number;
  fill: string;
};
interface Props extends ComponentProps<typeof Card> {
  data: SourceDatum[];
  totalMessages: number;
  otherSources?: { source: string; count: number }[];
  trendPercentage?: number;
  error?: string;
}
export function SourceMessageChart({
  data,
  totalMessages,
  otherSources = [],
  trendPercentage = 0,
  error,
  className,
  ...props
}: Props) {
  const rows = visibleMessageSources(data, otherSources);
  const config: ChartConfig = Object.fromEntries(
    rows.map((row) => [row.key, { label: row.label, color: row.fill }]),
  );
  return (
    <Card className={cn("min-w-0", className)} {...props}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Sources des messages</CardTitle>
          {!error && trendPercentage !== 0 && (
            <Delta value={trendPercentage} variant="badge">
              <DeltaIcon variant="trend" />
              <DeltaValue suffix="%" />
            </Delta>
          )}
        </div>
        <CardDescription>
          {error
            ? "Données indisponibles"
            : `Répartition sur les 7 derniers jours (${totalMessages} au total)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="py-8 text-sm text-muted-foreground">
            {error}
          </p>
        ) : rows.length && totalMessages > 0 ? (
          <div className="space-y-4">
            <div className="relative mx-auto aspect-square w-full max-w-64">
              <ChartContainer config={config} className="aspect-square size-full">
                <PieChart accessibilityLayer>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  {/* Les parts se lisent dans la liste ci-dessous, pas sur les tranches. */}
                  <Pie
                    data={rows}
                    dataKey="count"
                    nameKey="key"
                    innerRadius="58%"
                    outerRadius="92%"
                    startAngle={90}
                    endAngle={-270}
                    cornerRadius={rows.length > 1 ? 4 : 0}
                    stroke="var(--card)"
                    strokeWidth={rows.length > 1 ? 2 : 0}
                    isAnimationActive={false}
                  />
                </PieChart>
              </ChartContainer>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
              >
                <span className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
                  {totalMessages.toLocaleString("fr-FR")}
                </span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">
                  messages
                </span>
              </div>
            </div>
            <ul aria-label="Répartition des sources" className="divide-y">
              {rows.map((row) => (
                <li
                  key={row.source}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
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
            title="Aucun message sur cette période"
            description="La répartition apparaîtra dès la réception de messages."
          />
        )}
      </CardContent>
    </Card>
  );
}
