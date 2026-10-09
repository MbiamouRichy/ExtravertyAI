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
            <ChartContainer
              config={config}
              className="mx-auto h-52 w-full max-w-64 aspect-auto"
            >
              <PieChart accessibilityLayer>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={rows}
                  dataKey="count"
                  nameKey="key"
                  innerRadius={52}
                  outerRadius={84}
                  paddingAngle={3}
                  cornerRadius={6}
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
          <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <PieChartIcon aria-hidden="true" className="size-8" />
            <p className="text-sm">Aucun message sur cette période.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
