"use client";

import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { LabelList, Pie, PieChart } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    type ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

export type MessageSourceKey = "android" | "ios" | "ai" | "unknown";

export type SourceDatum = {
    source: MessageSourceKey;
    count: number;
    fill: string;
};

const chartConfig = {
    count: { label: "Messages" },
    android: { label: "Android", color: "var(--chart-1)" },
    ios: { label: "iOS", color: "var(--chart-2)" },
    ai: { label: "IA (Bot)", color: "var(--chart-3)" },
    unknown: { label: "Autre/Inconnu", color: "var(--chart-4)" },
} satisfies ChartConfig;

interface SourceMessageChartProps extends ComponentProps<typeof Card> {
    data: SourceDatum[];
    totalMessages: number;
    trendPercentage?: number;
}

export function SourceMessageChart({
    data,
    totalMessages,
    trendPercentage = 0,
    className,
    ...props
}: SourceMessageChartProps) {
    return (
        <Card
            className={cn("flex flex-col shadow-sm border-border/60", className)}
            {...props}
        >
            <CardHeader className="items-center space-y-1.5 pb-4 sm:items-start">
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-lg font-semibold tracking-tight">
                        Sources des messages
                    </CardTitle>
                    {trendPercentage !== 0 && (
                        <Delta value={trendPercentage} variant="badge" className="scale-95 origin-right">
                            <DeltaIcon variant="trend" />
                            <DeltaValue suffix="%" />
                        </Delta>
                    )}
                </div>
                <CardDescription className="text-sm text-muted-foreground">
                    Répartition sur les 7 derniers jours ({totalMessages} au total)
                </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 pb-6 flex flex-col justify-center">
                {totalMessages > 0 ? (
                    <ChartContainer
                        className="mx-auto aspect-square max-h-72 w-full"
                        config={chartConfig}
                    >
                        <PieChart accessibilityLayer>
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                            />

                            <Pie
                                cornerRadius={2}
                                data={data}
                                dataKey="count"
                                innerRadius={40}
                                nameKey="source"
                                outerRadius={95}
                                stroke="var(--card)"
                                strokeWidth={2}
                                paddingAngle={3}
                            >
                                <LabelList
                                    className="fill-background font-medium"
                                    dataKey="count"
                                    fill="currentColor"
                                    fontWeight={500}
                                    // 🛡️ CORRECTION ICI
                                    // 🛡️ Typage strict avec "unknown" au lieu de "any"
                                    formatter={(val: unknown) => {
                                        // 1. On rejette le vide et les cas de division par zéro
                                        if (totalMessages === 0 || val == null) return "";

                                        // 2. Type Guard : on s'assure que "val" est bien transformable en nombre
                                        if (typeof val !== "number" && typeof val !== "string") return "";

                                        // 3. Conversion sécurisée
                                        const numericValue = Number(val);
                                        if (isNaN(numericValue)) return "";

                                        // 4. Calcul final
                                        const percent = ((numericValue / totalMessages) * 100).toFixed(0);
                                        return percent !== "0" ? `${percent}%` : "";
                                    }}
                                />
                            </Pie>
                            <ChartLegend
                                className="mt-6 flex-wrap justify-center gap-4"
                                content={<ChartLegendContent nameKey="source" />}
                            />
                        </PieChart>
                    </ChartContainer>
                ) : (
                    <div className="flex flex-col aspect-square max-h-65 w-full items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
                        <div className="bg-muted/30 p-4 rounded-full mb-3 ring-1 ring-border/50">
                            <PieChartIcon className="w-8 h-8 text-muted-foreground/60" strokeWidth={1.5} />
                        </div>
                        <p className="text-sm font-medium text-foreground">Aucune donnée</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-50">
                            Connectez votre API WhatsApp pour voir la répartition ici.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}