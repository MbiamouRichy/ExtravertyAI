"use client";

import { Cell, Pie, PieChart } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";
import { AnalyticsCard } from "./analytics-card";
import { ChartEmptyState } from "./chart-empty-state";
import {
    formatNumberFr,
    formatPctFr,
    type SourceDatum,
} from "@/lib/analytics";

const SOURCE_META = new Map<
    string,
    { label: string; color: string }
>([
    ["android", { label: "Android", color: "var(--chart-1)" }],
    ["ios", { label: "iOS", color: "var(--chart-2)" }],
    ["ai", { label: "IA / Bot", color: "var(--chart-3)" }],
    [
        "unknown",
        { label: "Autre / inconnu", color: "var(--chart-4)" },
    ],
]);

interface SourcesChartProps {
    data: SourceDatum[];
    total: number;
    rangeLabel: string;
}

export function SourcesChart({
    data,
    total,
    rangeLabel,
}: SourcesChartProps) {
    const rows = [...data]
        .sort((a, b) => b.count - a.count)
        .map((datum, index) => {
            const meta = SOURCE_META.get(datum.source);

            return {
                ...datum,
                key: `source_${index}`,
                label: meta?.label ?? datum.source,
                fill: meta?.color ?? "var(--chart-5)",
            };
        });

    const config: ChartConfig = Object.fromEntries(
        rows.map((row) => [
            row.key,
            { label: row.label, color: row.fill },
        ]),
    );

    return (
        <AnalyticsCard
            title="Sources des messages"
            description={`Origine des messages reçus · ${rangeLabel}`}
            footer="Une source inconnue indique une origine non renseignée, pas nécessairement une anomalie."
        >
            {total === 0 ? (
                <ChartEmptyState
                    icon={PieChartIcon}
                    title="Aucune source disponible"
                    description="La répartition apparaîtra après réception de messages sur cette période."
                    className="h-full min-h-72"
                />
            ) : (
                <div className="flex h-full flex-col justify-center gap-5">
                    <div className="relative mx-auto size-56 max-w-full">
                        <ChartContainer
                            config={config}
                            className="aspect-square size-full"
                        >
                            <PieChart accessibilityLayer>
                                <ChartTooltip
                                    cursor={false}
                                    content={
                                        <ChartTooltipContent hideLabel />
                                    }
                                />

                                <Pie
                                    data={rows}
                                    dataKey="count"
                                    nameKey="key"
                                    innerRadius="55%"
                                    outerRadius="90%"
                                    paddingAngle={
                                        rows.filter((row) => row.count > 0)
                                            .length > 1
                                            ? 3
                                            : 0
                                    }
                                    cornerRadius={4}
                                    stroke="var(--card)"
                                    strokeWidth={3}
                                    isAnimationActive={false}
                                >
                                    {rows.map((row) => (
                                        <Cell
                                            key={row.key}
                                            fill={row.fill}
                                        />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ChartContainer>

                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                        >
                            <span className="text-3xl font-semibold tracking-tight tabular-nums">
                                {formatNumberFr(total)}
                            </span>
                            <span className="mt-1 text-xs text-muted-foreground">
                                messages reçus
                            </span>
                        </div>
                    </div>

                    <p className="sr-only">
                        {total.toLocaleString("fr-FR")} messages reçus.
                    </p>

                    <ul className="space-y-3">
                        {rows.map((row) => (
                            <li key={row.key} className="space-y-1.5">
                                <div className="flex items-center justify-between gap-3 text-xs">
                                    <span className="flex min-w-0 items-center gap-2">
                                        <span
                                            aria-hidden="true"
                                            className="size-2 shrink-0 rounded-full"
                                            style={{
                                                backgroundColor: row.fill,
                                            }}
                                        />
                                        <span className="wrap-break-word text-muted-foreground">
                                            {row.label}
                                        </span>
                                    </span>

                                    <span className="shrink-0 font-medium tabular-nums">
                                        {formatPctFr(
                                            (row.count / total) * 100,
                                        )}
                                        <span className="ml-2 font-normal text-muted-foreground">
                                            {row.count.toLocaleString(
                                                "fr-FR",
                                            )}
                                        </span>
                                    </span>
                                </div>

                                <div
                                    aria-hidden="true"
                                    className="h-1 overflow-hidden rounded-full bg-muted"
                                >
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            width: `${(row.count / total) * 100}%`,
                                            backgroundColor: row.fill,
                                        }}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </AnalyticsCard>
    );
}