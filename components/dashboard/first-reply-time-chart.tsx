"use client";
import { useSyncExternalStore } from "react";
import { Clock3 } from "lucide-react";
import { CartesianGrid, LabelList, Line, LineChart, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
    <Card className={cn("min-w-0 shadow-none dark:ring-0", className)}>
      <CardHeader className="space-y-1">
        <CardTitle>Temps de réponse IA · médiane</CardTitle>
        <CardDescription>
          Délai entre le message client et l’envoi confirmé de sa réponse IA,
          sur les 7 derniers jours.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              seconds: { label: "Délai médian", color: "var(--chart-2)" },
            }}
            className="aspect-video min-h-48 w-full min-w-0"
          >
            <LineChart
              accessibilityLayer
              data={points}
              margin={{ top: 28, right: 28, bottom: 8, left: 28 }}
            >
              <CartesianGrid vertical={false} className="stroke-border" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                tickFormatter={(value) => String(value).slice(0, 3)}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
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
                type="natural"
                dataKey="seconds"
                stroke="var(--color-seconds)"
                strokeWidth={2}
                connectNulls={false}
                dot={{ r: 4, fill: "var(--color-seconds)" }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="seconds"
                  className="fill-foreground"
                  fontSize={12}
                  offset={12}
                  position="top"
                  formatter={(value) =>
                    typeof value === "number" && Number.isFinite(value)
                      ? formatResponseTime(value)
                      : ""
                  }
                />
              </Line>
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
