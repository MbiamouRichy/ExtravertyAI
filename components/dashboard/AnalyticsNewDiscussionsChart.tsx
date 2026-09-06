"use client";

import { useId } from "react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
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
import { formatDate } from "@/components/formater";
export type AnalyticsDiscussionRow = {
    date: string;
    count: number;
};

interface AnalyticsDiscussionsChartProps {
    data: AnalyticsDiscussionRow[];
    total: number;
    periodLabel: string;
}

const chartConfig = {
    count: {
        label: "Discussions",
        color: "var(--chart-1)",
    },
} satisfies ChartConfig;

export function AnalyticsDiscussionsChart({ data, total, periodLabel }: AnalyticsDiscussionsChartProps) {
    const chartUid = useId().replace(/:/g, "");
    const idLineGlow = `analytics-discussions-glow-${chartUid}`;

    const hasData = data && data.length > 0;

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <div className="flex flex-col gap-1">
                    <CardTitle className="text-2xl font-bold tracking-tight">
                        {total.toLocaleString()} discussions
                    </CardTitle>
                    <CardDescription>
                        Volume généré sur : {periodLabel}
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                {!hasData ? (
                    <div className="flex aspect-auto h-64 w-full items-center justify-center text-muted-foreground md:h-87.5">
                        Aucune donnée pour cette période.
                    </div>
                ) : (
                    <ChartContainer
                        config={chartConfig}
                        className="aspect-auto h-64 w-full p-0 md:h-87.5"
                    >
                        <LineChart
                            accessibilityLayer
                            data={data}
                            margin={{ left: 12, right: 12, top: 8 }}
                        >
                            <CartesianGrid className="stroke-border" vertical={false} />
                            <XAxis
                                axisLine={false}
                                dataKey="date"
                                interval="preserveStartEnd" // Permet d'éviter que les dates se chevauchent sur 30j+
                                tickFormatter={(value) => {
                                    // Utilise ton formateur ou la méthode native
                                    try {
                                        return formatDate(String(value), "day-month");
                                    } catch {
                                        return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                                    }
                                }}
                                tickLine={false}
                                tickMargin={8}
                            />
                            <ChartTooltip
                                content={<ChartTooltipContent hideLabel />}
                                cursor={false}
                            />
                            <defs>
                                <filter
                                    height="140%"
                                    id={idLineGlow}
                                    width="140%"
                                    x="-20%"
                                    y="-20%"
                                >
                                    <feGaussianBlur result="blur" stdDeviation="10" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                            </defs>
                            <Line
                                dataKey="count"
                                dot={false}
                                filter={`url(#${idLineGlow})`}
                                stroke="var(--color-count)"
                                strokeWidth={2}
                                type="step"
                            />
                        </LineChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
}