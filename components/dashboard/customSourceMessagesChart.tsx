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

const SOURCE_LABELS = new Map<string, string>([
    ["android", "WhatsApp Android"],
    ["ios", "WhatsApp iPhone"],
    ["whatsapp", "WhatsApp"],
    ["web", "WhatsApp Web"],
    ["desktop", "WhatsApp Desktop"],
    ["ai", "IA / Bot"],
    ["unknown", "Autre / inconnu"],
]);

// Couleur attribuée par rang : la source principale est toujours la plus contrastée.
const RANK_COLORS = [
    "var(--chart-5)",
    "var(--chart-3)",
    "var(--chart-2)",
    "var(--chart-1)",
    "var(--chart-4)",
];

interface SourcesChartProps {
    data: SourceDatum[];
    total: number;
    rangeLabel: string;
}

export function SourcesChart({ data, total, rangeLabel }: SourcesChartProps) {
    const rows = [...data]
        .sort((a, b) => b.count - a.count)
        .map((datum, index) => {
            return {
                ...datum,
                key: `source_${index}`,
                label:
                    SOURCE_LABELS.get(datum.source.toLowerCase()) ??
                    datum.source,
                fill: RANK_COLORS[index % RANK_COLORS.length],
            };
        });
    const multiple = rows.filter((row) => row.count > 0).length > 1;

    const config: ChartConfig = Object.fromEntries(
        rows.map((row) => [row.key, { label: row.label, color: row.fill }]),
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
                <div className="flex h-full flex-col justify-center gap-6">
                    <div className="relative mx-auto size-48 max-w-full">
                        <ChartContainer
                            config={config}
                            className="aspect-square size-full"
                        >
                            <PieChart accessibilityLayer>
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent hideLabel />}
                                />
                                {/* Piste de fond : l’anneau reste lisible même avec une seule source. */}
                                <Pie
                                    data={[{ value: 1 }]}
                                    dataKey="value"
                                    innerRadius="76%"
                                    outerRadius="92%"
                                    fill="var(--muted)"
                                    stroke="none"
                                    isAnimationActive={false}
                                    tooltipType="none"
                                />
                                <Pie
                                    data={rows}
                                    dataKey="count"
                                    nameKey="key"
                                    innerRadius="76%"
                                    outerRadius="92%"
                                    startAngle={90}
                                    endAngle={-270}
                                    paddingAngle={multiple ? 3 : 0}
                                    cornerRadius={multiple ? 6 : 0}
                                    stroke="none"
                                    isAnimationActive={false}
                                >
                                    {rows.map((row) => (
                                        <Cell key={row.key} fill={row.fill} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ChartContainer>

                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                        >
                            <span className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
                                {formatNumberFr(total)}
                            </span>
                            <span className="mt-0.5 text-[11px] text-muted-foreground">
                                messages reçus
                            </span>
                        </div>
                    </div>

                    <p className="sr-only">
                        {total.toLocaleString("fr-FR")} messages reçus.
                    </p>

                    <ul className="divide-y rounded-xl border">
                        {rows.map((row) => (
                            <li
                                key={row.key}
                                className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <span
                                        aria-hidden="true"
                                        className="size-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: row.fill }}
                                    />
                                    <span className="truncate">{row.label}</span>
                                </span>
                                <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                                    <span className="text-muted-foreground">
                                        {row.count.toLocaleString("fr-FR")}
                                    </span>
                                    <span className="w-14 text-right font-medium">
                                        {formatPctFr((row.count / total) * 100)}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </AnalyticsCard>
    );
}
