"use client";
import { useSyncExternalStore } from "react";
import { Clock3 } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { AnalyticsCard } from "./analytics-card";
import { ChartEmptyState } from "./chart-empty-state";
import {
  responseTimeSeries,
  formatResponseTime,
  type ResponseSample,
} from "@/lib/ai-response-metrics";
const subscribe = () => () => {};
export function FirstAiReplyTimeChart({
  data,
  className,
}: {
  data: { samples: ResponseSample[]; now: string; error: boolean };
  className?: string;
}) {
  const zone = useSyncExternalStore(
    subscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );
  const points = responseTimeSeries(data.samples, data.now, zone || "UTC");
  const count = points.reduce((sum, p) => sum + p.count, 0);
  return (
    <AnalyticsCard
      className={className}
      title="Temps de réponse IA · médiane"
      description="Délai entre le message client et l’envoi confirmé de sa réponse IA, sur les 7 derniers jours."
    >
      {data.error || !zone || !count ? (
        <ChartEmptyState
          icon={Clock3}
          title={
            data.error
              ? "Mesure indisponible"
              : !zone
                ? "Chargement du graphique…"
                : "Aucune réponse IA envoyée"
          }
          description={
            data.error
              ? "Les données n’ont pas pu être chargées. Réessayez en actualisant la page."
              : "Le délai apparaîtra après la première réponse IA envoyée pendant cette période."
          }
        />
      ) : (
        <ChartContainer
          config={{
            seconds: { label: "Délai médian", color: "var(--primary)" },
          }}
          className="h-64 w-full min-w-0 aspect-auto sm:h-80"
        >
          <LineChart
            accessibilityLayer
            data={points}
            margin={{ top: 16, right: 12, bottom: 8, left: 0 }}
          >
            <CartesianGrid vertical={false} className="stroke-border" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
            />
            <YAxis
              domain={[0, "auto"]}
              width={52}
              tickLine={false}
              axisLine={false}
              tickFormatter={(seconds: number) =>
                seconds < 1
                  ? `${new Intl.NumberFormat("fr-FR", { maximumSignificantDigits: 3 }).format(seconds * 1000)} ms`
                  : formatResponseTime(seconds)
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.date || ""
                  }
                  formatter={(value) => (
                    <span className="font-medium">
                      {formatResponseTime(Number(value))}
                    </span>
                  )}
                />
              }
            />
            <Line
              type="linear"
              dataKey="seconds"
              stroke="var(--color-seconds)"
              strokeWidth={2}
              connectNulls={false}
              dot={{ r: 4, fill: "var(--color-seconds)" }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      )}
    </AnalyticsCard>
  );
}
