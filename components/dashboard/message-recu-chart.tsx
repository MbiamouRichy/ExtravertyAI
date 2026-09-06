"use client";

import type * as React from "react";
import { Bar, BarChart, XAxis } from "recharts";
import {
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
import { DashboardCard } from "@/components/dashboard/dashboard-card";

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
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

// Ton CustomGradientBar (adapté pour 'messages')
function CustomGradientBar(
	props: React.SVGProps<SVGRectElement> & {
		index?: number;
		dataKey?: string | number;
	}
) {
	const { fill, x = 0, y = 0, width = 0, height = 0, dataKey = "messages", index = 0 } = props;
	const gid = `gradient-bar-${String(dataKey)}-${index}`;

	return (
		<>
			<rect fill={`url(#${gid})`} height={height} stroke="none" width={width} x={x} y={y} />
			<rect fill={fill} height={2} stroke="none" width={width} x={x} y={y} />
			<defs>
				<linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
					<stop offset="0%" stopColor={fill} stopOpacity={0.5} />
					<stop offset="100%" stopColor={fill} stopOpacity={0} />
				</linearGradient>
			</defs>
		</>
	);
}

export function MessagesChart({
	title = "Messages Reçus",
	description = "Volume de messages entrants.",
	data,
	growthPct,
	className = "gap-0 md:col-span-2",
}: MessagesChartProps) {
	return (
		<DashboardCard className={className}>
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
						<Bar dataKey="messages" fill="var(--color-messages, #3b82f6)" shape={<CustomGradientBar />} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</DashboardCard>
	);
}