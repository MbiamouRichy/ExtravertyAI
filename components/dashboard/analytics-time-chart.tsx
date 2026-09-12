"use client";

import { useId } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    XAxis,
    YAxis,
} from "recharts";

import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";
import { AnalyticsCard } from "./analytics-card";
import { ChartEmptyState } from "./chart-empty-state";
import { formatNumberFr } from "@/lib/analytics";

type MetricKey = "received" | "sent" | "count";

export interface TimeChartPoint {
    date: string;
    dateLabel: string;
    received?: number;
    sent?: number;
    count?: number;
}

interface Metric {
    key: MetricKey;
    label: string;
    color: string;
    dashed?: boolean;
}

interface AnalyticsTimeChartProps {
    title: string;
    description: string;
    data: TimeChartPoint[];
    metrics: Metric[];
    kind?: "area" | "bar" | "step";
    emptyTitle: string;
    emptyDescription: string;
}

const exactNumber = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
});

export function AnalyticsTimeChart({
    title,
    description,
    data,
    metrics,
    kind = "step",
    emptyTitle,
    emptyDescription,
}: AnalyticsTimeChartProps) {
    const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

    const config: ChartConfig = Object.fromEntries(
        metrics.map((metric) => [
            metric.key,
            {
                label: metric.label,
                color: metric.color,
            },
        ]),
    );

    const labels = new Map(
        data.map((point) => [point.date, point.dateLabel]),
    );

    const totals = metrics.map((metric) => ({
        ...metric,
        total: data.reduce(
            (sum, point) => sum + (point[metric.key] ?? 0),
            0,
        ),
    }));

    const hasActivity = data.some((point) =>
        metrics.some((metric) => (point[metric.key] ?? 0) > 0),
    );

    const chartMargin = {
        top: 14,
        right: 16,
        left: 0,
        bottom: 8,
    };

    const axes = (
        <>
            <CartesianGrid
                vertical={false}
                strokeDasharray="3 5"
                className="stroke-border/60"
            />

            <XAxis
                dataKey="date"
                tickFormatter={(value) =>
                    labels.get(String(value)) ?? String(value)
                }
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                minTickGap={28}
                interval="preserveStartEnd"
                fontSize={11}
                padding={{ left: 8, right: 8 }}
            />

            <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={44}
                tickMargin={8}
                tickFormatter={formatNumberFr}
                fontSize={11}
                domain={[0, "auto"]}
            />

            <ChartTooltip
                cursor={{
                    stroke: "var(--border)",
                    strokeDasharray: "4 4",
                }}
                content={
                    <ChartTooltipContent
                        indicator="line"
                        labelFormatter={(value) =>
                            `Début du regroupement : ${String(value)} · UTC`
                        }
                    />
                }
            />
        </>
    );

    return (
        <AnalyticsCard
            title={title}
            description={description}
            footer={
                <details>
                    <summary className="w-fit cursor-pointer rounded font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        Consulter les valeurs
                    </summary>

                    <div
                        role="region"
                        aria-label={`Valeurs : ${title}`}
                        tabIndex={0}
                        className="mt-3 max-h-64 overflow-auto rounded-lg border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <table className="w-full text-left text-xs">
                            <caption className="sr-only">
                                {title}. {description}. Dates en UTC.
                            </caption>

                            <thead className="sticky top-0 bg-muted">
                                <tr>
                                    <th
                                        scope="col"
                                        className="whitespace-nowrap px-3 py-2 font-medium"
                                    >
                                        Début · UTC
                                    </th>

                                    {metrics.map((metric) => (
                                        <th
                                            key={metric.key}
                                            scope="col"
                                            className="whitespace-nowrap px-3 py-2 text-right font-medium"
                                        >
                                            {metric.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {data.map((point) => (
                                    <tr
                                        key={point.date}
                                        className="border-t border-border/60"
                                    >
                                        <th
                                            scope="row"
                                            className="whitespace-nowrap px-3 py-2 font-normal"
                                        >
                                            {point.date}
                                        </th>

                                        {metrics.map((metric) => (
                                            <td
                                                key={metric.key}
                                                className="px-3 py-2 text-right tabular-nums"
                                            >
                                                {exactNumber.format(
                                                    point[metric.key] ?? 0,
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {data.length === 0 && (
                            <p className="p-3">
                                Aucune valeur disponible.
                            </p>
                        )}
                    </div>
                </details>
            }
        >
            <ul
                aria-label="Totaux des séries"
                className="mb-6 flex flex-wrap gap-x-8 gap-y-4"
            >
                {totals.map((metric) => (
                    <li key={metric.key}>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span
                                aria-hidden="true"
                                className="w-5 border-t-2"
                                style={{
                                    borderColor: metric.color,
                                    borderTopStyle: metric.dashed
                                        ? "dashed"
                                        : "solid",
                                }}
                            />
                            {metric.label}
                        </div>

                        <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                            {formatNumberFr(metric.total)}
                        </p>
                    </li>
                ))}
            </ul>

            {!hasActivity ? (
                <ChartEmptyState
                    icon={ChartNoAxesCombined}
                    title={emptyTitle}
                    description={emptyDescription}
                    className="h-64 sm:h-80"
                />
            ) : (
                <ChartContainer
                    config={config}
                    className="aspect-auto h-64 w-full p-0 sm:h-80"
                >
                    {kind === "bar" ? (
                        <BarChart
                            accessibilityLayer
                            data={data}
                            margin={chartMargin}
                            barGap={4}
                            barCategoryGap="24%"
                        >
                            {axes}

                            {metrics.map((metric) => (
                                <Bar
                                    key={metric.key}
                                    dataKey={metric.key}
                                    fill={`var(--color-${metric.key})`}
                                    fillOpacity={0.9}
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={30}
                                    isAnimationActive={false}
                                />
                            ))}
                        </BarChart>
                    ) : kind === "step" ? (
                        <LineChart
                            accessibilityLayer
                            data={data}
                            margin={chartMargin}
                        >
                            {axes}

                            {metrics.map((metric) => (
                                <Line
                                    key={metric.key}
                                    dataKey={metric.key}
                                    type="step"
                                    stroke={`var(--color-${metric.key})`}
                                    strokeWidth={2}
                                    strokeLinejoin="round"
                                    strokeDasharray={
                                        metric.dashed ? "5 4" : undefined
                                    }
                                    dot={
                                        data.length === 1
                                            ? {
                                                r: 4,
                                                fill: `var(--color-${metric.key})`,
                                            }
                                            : false
                                    }
                                    activeDot={{
                                        r: 4,
                                        stroke: "var(--card)",
                                        strokeWidth: 2,
                                    }}
                                    isAnimationActive={false}
                                />
                            ))}
                        </LineChart>
                    ) : (
                        <AreaChart
                            accessibilityLayer
                            data={data}
                            margin={chartMargin}
                        >
                            <defs>
                                {metrics.map((metric) => (
                                    <linearGradient
                                        key={metric.key}
                                        id={`${uid}-${metric.key}`}
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="0%"
                                            stopColor={`var(--color-${metric.key})`}
                                            stopOpacity={0.18}
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor={`var(--color-${metric.key})`}
                                            stopOpacity={0.01}
                                        />
                                    </linearGradient>
                                ))}
                            </defs>

                            {axes}

                            {metrics.map((metric) => (
                                <Area
                                    key={metric.key}
                                    dataKey={metric.key}
                                    type="linear"
                                    stroke={`var(--color-${metric.key})`}
                                    strokeWidth={2}
                                    strokeDasharray={
                                        metric.dashed ? "5 4" : undefined
                                    }
                                    fill={`url(#${uid}-${metric.key})`}
                                    dot={
                                        data.length === 1
                                            ? { r: 4 }
                                            : false
                                    }
                                    activeDot={{
                                        r: 4,
                                        stroke: "var(--card)",
                                        strokeWidth: 2,
                                    }}
                                    isAnimationActive={false}
                                />
                            ))}
                        </AreaChart>
                    )}
                </ChartContainer>
            )}
        </AnalyticsCard>
    );
}