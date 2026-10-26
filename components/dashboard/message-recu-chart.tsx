"use client";

import type * as React from "react";
import { Bar, BarChart, XAxis } from "recharts";
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

// On définit le format des données attendues
export type ChartDataPoint = {
	dateLabel: string; // ex: "Lun", "12/04", "Janv"
	messages: number;
};

interface MessagesChartProps {
	title?: string;
	description?: string;
	data: ChartDataPoint[];
	growthPct: number;
	className?: string;
}

const chartConfig = {
	messages: {
		label: "Messages Reçus",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

export function MessagesChart({
	title = "Messages Reçus",
	description = "Volume de messages entrants.",
	data,
	growthPct,
	className = "gap-0 ",
}: MessagesChartProps) {
	return (
		<Card className={className}>
			<CardHeader className="gap-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<CardTitle>{title}</CardTitle>
						<Delta value={Number(growthPct)} variant="badge">
							<DeltaIcon variant="trend" />
							<DeltaValue />
						</Delta>
					</div>
				</div>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer className="aspect-auto h-60 w-full md:h-80" config={chartConfig}>
					<BarChart accessibilityLayer data={data}>
						<XAxis
							axisLine={false}
							dataKey="dateLabel"
							interval="preserveStartEnd" // Évite que les labels se chevauchent sur 30 jours
							tickFormatter={(value) => String(value)}
							tickLine={false}
							tickMargin={10}
							minTickGap={20}
						/>
						<ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
						<Bar dataKey="messages" fill="var(--color-messages)" radius={[6, 6, 0, 0]} maxBarSize={56} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}