"use client";
import { useSyncExternalStore } from "react";
import { Clock3 } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
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
          <>
          <p className="mb-4 text-xs text-muted-foreground">
            Calculé sur{" "}
            <span className="font-medium text-foreground tabular-nums">
              {count.toLocaleString("fr-FR")}
            </span>{" "}
            réponse{count > 1 ? "s" : ""} envoyée{count > 1 ? "s" : ""}.
          </p>
          <ChartContainer
            config={{
              seconds: { label: "Délai médian", color: "var(--chart-1)" },
            }}
            className="aspect-auto h-56 w-full min-w-0 md:h-64"
          >
            <LineChart
              accessibilityLayer
              data={points}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 5" className="stroke-border/60" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                interval={0}
                fontSize={11}
                padding={{ left: 12, right: 12 }}
                tickFormatter={(value) => String(value).slice(0, 3)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tickMargin={6}
                fontSize={11}
                tickFormatter={(value) =>
                  Number(value) === 0 ? "0 s" : formatResponseTime(Number(value))
                }
              />
              <ChartTooltip
                cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    hideLabel
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.date || ""
                    }
                    formatter={(value, _name, item) => (
                      <div className="flex min-w-40 items-stretch gap-2">
                        <span className="w-1 shrink-0 rounded-full bg-(--color-seconds)" />
                        <div className="flex-1 space-y-1">
                          <p className="font-medium">
                            {new Intl.DateTimeFormat("fr-FR", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              timeZone: "UTC",
                            }).format(
                              new Date(item.payload.date + "T12:00:00Z"),
                            )}
                          </p>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                              Délai médian
                            </span>
                            <span className="font-mono font-medium tabular-nums">
                              {formatResponseTime(Number(value))}
                            </span>
                          </div>
                        </div>
                      </div>
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
                dot={{ r: 3, fill: "var(--color-seconds)", strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
