"use client";

import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { CartesianGrid, LabelList, Line, LineChart, XAxis } from "recharts";
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
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

export type ReplyRow = {
    day: string;
    minutes: number;
};

// Définition des props pour accepter les données dynamiques
interface FirstAiReplyTimeChartProps extends ComponentProps<typeof Card> {
    data: ReplyRow[];
}

const chartConfig = {
    minutes: {
        label: "Minutes (IA)",
        color: "var(--chart-2)",
    },
} satisfies ChartConfig;

export function FirstAiReplyTimeChart({
    data,
    className,
    ...props
}: FirstAiReplyTimeChartProps) {
    // Sécurité UX : Valeurs par défaut si le tableau est vide
    const firstMinutes = data[0]?.minutes ?? 0;
    const lastMinutes = data.at(-1)?.minutes ?? firstMinutes;

    /** 
     * Positive = amélioration (l'IA répond plus vite).
     * Calcul de l'évolution entre le premier jour de la semaine et le dernier.
     */
    const replyImprovementPct =
        firstMinutes > 0 ? ((firstMinutes - lastMinutes) / firstMinutes) * 100 : 0;

    return (
        <Card
            className={cn("shadow-none bg-background md:col-span-2 dark:ring-0", className)}
            {...props}
        >
            <CardHeader className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>Temps de réponse IA (Médiane)</CardTitle>
                    {/* On n'affiche le delta que s'il y a de la donnée */}
                    {firstMinutes > 0 && (
                        <Delta value={replyImprovementPct} variant="badge">
                            <DeltaIcon variant="trend" />
                            <DeltaValue />
                        </Delta>
                    )}
                </div>
                <CardDescription>
                    Temps moyen en minutes avant que le Bot ne réponde, 7 derniers jours.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    // UX: État vide élégant si aucune donnée n'est disponible
                    <div className="flex aspect-video w-full items-center justify-center text-muted-foreground text-sm">
                        Pas assez de données pour l&apos;instant.
                    </div>
                ) : (
                    <ChartContainer className="aspect-video w-full" config={chartConfig}>
                        <LineChart
                            accessibilityLayer
                            data={data}
                            margin={{ top: 24, left: 20, right: 12, bottom: 8 }}
                        >
                            <CartesianGrid className="stroke-border" vertical={false} />
                            <XAxis
                                axisLine={false}
                                dataKey="day"
                                interval={0}
                                tickFormatter={(value) => String(value).slice(0, 3)}
                                tickLine={false}
                                tickMargin={8}
                            />
                            <ChartTooltip
                                content={<ChartTooltipContent indicator="line" />}
                                cursor={false}
                            />
                            <Line
                                activeDot={{ r: 6 }}
                                dataKey="minutes"
                                dot={{ fill: "var(--color-minutes)" }}
                                stroke="var(--color-minutes)"
                                strokeWidth={2}
                                type="natural"
                            >
                                <LabelList
                                    className="fill-foreground"
                                    dataKey="minutes"
                                    fontSize={12}
                                    // On ajoute 'null' pour satisfaire le type RenderableText de Recharts
                                    formatter={(label: string | number | boolean | null | undefined) => {
                                        // Sécurité : si la donnée est absente ou nulle, on affiche "0m" (ou "")
                                        if (label === null || label === undefined) return "0m";

                                        const n = Number(label);
                                        return Number.isFinite(n) && n > 0
                                            ? `${n.toFixed(1)}m`
                                            : "0m";
                                    }}
                                    offset={12}
                                    position="top"
                                />
                            </Line>
                        </LineChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
}