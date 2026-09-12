"use client";

import { MessageSquarePlus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";
import { ChartEmptyState } from "./chart-empty-state";
import { formatNumberFr, type DiscussionPoint } from "@/lib/analytics";

const chartConfig = {
    count: { label: "Discussions", color: "var(--chart-1)" },
} satisfies ChartConfig;

interface DiscussionsChartProps {
    data: DiscussionPoint[];
    rangeLabel: string;
}

export function NewDiscussionsChart({ data, rangeLabel }: DiscussionsChartProps) {
    const total = data.reduce((acc, point) => acc + point.count, 0);

    return (
        <Card className="flex h-full flex-col shadow-sm">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1.5">
                    <CardTitle className="text-lg font-semibold tracking-tight">
                        Nouvelles discussions
                    </CardTitle>
                    <CardDescription>Conversations démarrées sur : {rangeLabel}</CardDescription>
                </div>
                <Badge variant="secondary" className="w-fit tabular-nums">
                    {formatNumberFr(total)} nouvelles
                </Badge>
            </CardHeader>

            <CardContent className="flex-1 pb-6">
                {total === 0 ? (
                    <ChartEmptyState
                        icon={MessageSquarePlus}
                        title="Aucune nouvelle discussion"
                        description="Les nouvelles conversations entrantes apparaîtront ici."
                    />
                ) : (
                    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full sm:h-72 md:h-80">
                        <BarChart accessibilityLayer data={data} margin={{ left: 8, right: 8, top: 8 }}>
                            <CartesianGrid vertical={false} className="stroke-border" />
                            <XAxis
                                dataKey="dateLabel"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                interval="preserveStartEnd"
                            />
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
                            <Bar
                                dataKey="count"
                                fill="var(--color-count)"
                                radius={[6, 6, 0, 0]}
                                maxBarSize={36}
                            />
                        </BarChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
}

export {
    AnalyticsDiscussionsChart as DiscussionsChart,
} from "./AnalyticsNewDiscussionsChart";